/* ── SFTP Worker (russh-sftp) ── */

#[path = "sftp_worker/events.rs"]
mod events;
#[path = "sftp_worker/fs_ops.rs"]
mod fs_ops;
#[path = "sftp_worker/main_loop.rs"]
mod main_loop;
#[path = "sftp_worker/parsing.rs"]
mod parsing;

use russh::keys::PrivateKeyWithHashAlg;
use russh_sftp::client::SftpSession;
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc as tokio_mpsc;
use uuid::Uuid;
use sqlx::SqlitePool;

use super::ssh_worker::HostKeyDecision;
use crate::server::helpers::{
    EstablishRusshSessionError, HostKeyConnectDecision, RusshEndpoint, establish_russh_session_via_jump,
    establish_russh_session_with_context, format_private_key_parse_error,
};

use events::{emit_hostkey_prompt, wait_for_hostkey_decision};
use main_loop::sftp_main_loop;
use parsing::{endpoint_matches_prompt, parse_jump_config};

#[derive(Clone)]
pub struct SftpWorker {
    pub tx: tokio_mpsc::UnboundedSender<WorkerReq>,
    pub hostkey_tx: tokio_mpsc::UnboundedSender<HostKeyDecision>,
}

#[derive(Debug)]
pub enum WorkerReq {
    List { path: String, request_id: Option<String> },
    Stat { path: String, request_id: Option<String> },
    Mkdir { path: String, request_id: Option<String> },
    Rename { old_path: String, new_path: String, request_id: Option<String> },
    Delete { path: String, is_dir: bool, request_id: Option<String> },
    ReadFile { path: String, request_id: Option<String> },
    WriteFile { path: String, content: String, request_id: Option<String> },
    UploadStart { transfer_id: String, remote_path: String, file_size: i64, request_id: Option<String> },
    UploadChunk { transfer_id: String, chunk: String, #[allow(dead_code)] request_id: Option<String> },
    UploadEnd { transfer_id: String, request_id: Option<String> },
    DownloadStart { transfer_id: String, remote_path: String, request_id: Option<String> },
    DownloadCancel { transfer_id: String },
    Chmod { path: String, mode: u32, recursive: bool, request_id: Option<String> },
    Touch { path: String, is_dir: bool, request_id: Option<String> },
    Exec { command: String, request_id: Option<String> },
    Disconnect,
}

pub use parsing::build_worker_req;

pub fn start_sftp_worker(
    connect: Value,
    event_tx: tokio_mpsc::UnboundedSender<Value>,
    known_hosts_path: PathBuf,
    session_key: String,
    pool: SqlitePool,
) -> Result<SftpWorker, String> {
    let data = connect.as_object().ok_or_else(|| "连接数据无效".to_string())?;
    let host = data.get("host").and_then(|v| v.as_str()).ok_or_else(|| "缺少主机".to_string())?.to_string();
    let username = data.get("username").and_then(|v| v.as_str()).ok_or_else(|| "缺少用户名".to_string())?.to_string();
    let port = data.get("port").and_then(|v| v.as_i64()).unwrap_or(22) as u16;
    let password = data.get("password").and_then(|v| v.as_str()).map(|v| v.to_string());
    let private_key = data.get("privateKey").and_then(|v| v.as_str()).map(|v| v.to_string());
    let passphrase = data.get("passphrase").and_then(|v| v.as_str()).map(|v| v.to_string());
    let connection_id = data.get("connectionId").and_then(|v| v.as_str()).map(|v| v.to_string());
    let connection_name = data.get("connectionName").and_then(|v| v.as_str()).map(|v| v.to_string());
    let jump = parse_jump_config(data)?;

    let (tx, mut rx) = tokio_mpsc::unbounded_channel::<WorkerReq>();
    let (hostkey_tx, mut hostkey_rx) = tokio_mpsc::unbounded_channel::<HostKeyDecision>();

    tokio::spawn(async move {
        let endpoint = RusshEndpoint {
            host: host.clone(),
            port,
            username: username.clone(),
            connection_id: connection_id.clone(),
            connection_name: connection_name.clone(),
        };
        let mut connect_decision = HostKeyConnectDecision::Reject;
        let mut jump_decision = HostKeyConnectDecision::Reject;
        let mut handle = loop {
            let connect_result = if let Some(jump_config) = jump.as_ref() {
                establish_russh_session_via_jump(&endpoint, known_hosts_path.clone(), connect_decision, jump_config, jump_decision)
                    .await
                    .map(|session| session.handle)
            } else {
                establish_russh_session_with_context(&endpoint, known_hosts_path.clone(), connect_decision).await
            };

            match connect_result {
                Ok(session) => break session,
                Err(EstablishRusshSessionError::HostKeyVerificationRequired(prompt)) => {
                    let request_id = Uuid::new_v4().to_string();
                    emit_hostkey_prompt(&event_tx, &prompt, &request_id);

                    let Some(decision) = wait_for_hostkey_decision(&mut hostkey_rx, &request_id).await else {
                        let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": "SSH host identity verification was interrupted." }}));
                        return;
                    };
                    if !decision.trust {
                        let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": "SSH host trust was rejected." }}));
                        return;
                    }

                    let next_decision = if decision.replace_existing {
                        HostKeyConnectDecision::Replace
                    } else {
                        HostKeyConnectDecision::Trust
                    };
                    if let Some(jump_config) = jump.as_ref() {
                        if endpoint_matches_prompt(&jump_config.endpoint, &prompt) {
                            jump_decision = next_decision;
                        } else {
                            connect_decision = next_decision;
                        }
                    } else {
                        connect_decision = next_decision;
                    }
                }
                Err(EstablishRusshSessionError::Message(e)) => {
                    tracing::error!("SFTP russh connection failed ({}): {}", host, e);
                    let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": format!("Connection failed: {}", e) }}));
                    return;
                }
            }
        };

        let auth_result = if let Some(pk) = private_key.clone() {
            match russh::keys::decode_secret_key(&pk, passphrase.as_deref()) {
                Ok(key_pair) => match handle.best_supported_rsa_hash().await {
                    Ok(hash) => {
                        let h = hash.flatten();
                        handle.authenticate_publickey(&username, PrivateKeyWithHashAlg::new(Arc::new(key_pair), h)).await.map_err(|e| e.to_string())
                    }
                    Err(e) => Err(e.to_string()),
                },
                Err(e) => Err(format!("私钥解析失败: {}", e)),
            }
        } else if let Some(pwd) = password.clone() {
            handle.authenticate_password(&username, &pwd).await.map_err(|e| e.to_string())
        } else {
            Err("缺少认证凭据".to_string())
        };

        let auth_result = auth_result.map_err(|e| {
            if e.to_ascii_lowercase().contains("the key is encrypted") {
                format_private_key_parse_error("The key is encrypted", passphrase.is_some())
            } else {
                e
            }
        });
        let auth_ok = match auth_result {
            Ok(res) => res.success(),
            Err(e) => {
                tracing::error!("SFTP 认证错误 ({}): {}", host, e);
                false
            }
        };
        if !auth_ok {
            tracing::error!("SFTP 认证失败 ({})", host);
            let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": "认证失败" } }));
            return;
        }

        let channel = match handle.channel_open_session().await {
            Ok(c) => c,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": format!("打开通道失败: {}", e) } }));
                return;
            }
        };
        if let Err(e) = channel.request_subsystem(true, "sftp").await {
            let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": format!("请求 SFTP 子系统失败: {}", e) } }));
            return;
        }

        let sftp = match SftpSession::new(channel.into_stream()).await {
            Ok(s) => s,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": format!("SFTP 会话初始化失败: {}", e) } }));
                return;
            }
        };

        let home = sftp.canonicalize(".").await.unwrap_or_else(|_| "/".to_string());
        let _ = event_tx.send(json!({ "type": "sftp-ready", "data": { "home": home } }));
        sftp_main_loop(sftp, &mut rx, &event_tx, &session_key, &pool).await;
    });

    Ok(SftpWorker { tx, hostkey_tx })
}
