/* ── SFTP Worker (russh-sftp) ── */

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64_STD;
use chrono::Utc;
use russh::keys::PrivateKeyWithHashAlg;
use russh_sftp::client::SftpSession;
use russh_sftp::client::fs::{File, Metadata};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::mpsc as tokio_mpsc;
use uuid::Uuid;

use super::{WsMessage, ssh_worker::HostKeyDecision};
use crate::server::helpers::{
    EstablishRusshSessionError, HostKeyConnectDecision, HostKeyVerificationPrompt, RusshAuthConfig,
    RusshEndpoint, RusshJumpHostConfig, establish_russh_session_via_jump,
    establish_russh_session_with_context, format_private_key_parse_error,
};

/* ── 类型 ── */

#[derive(Clone)]
pub struct SftpWorker {
    pub tx: tokio_mpsc::UnboundedSender<WorkerReq>,
    pub hostkey_tx: tokio_mpsc::UnboundedSender<HostKeyDecision>,
}

#[derive(Debug)]
pub enum WorkerReq {
    List {
        path: String,
        request_id: Option<String>,
    },
    Stat {
        path: String,
        request_id: Option<String>,
    },
    Mkdir {
        path: String,
        request_id: Option<String>,
    },
    Rename {
        old_path: String,
        new_path: String,
        request_id: Option<String>,
    },
    Delete {
        path: String,
        is_dir: bool,
        request_id: Option<String>,
    },
    ReadFile {
        path: String,
        request_id: Option<String>,
    },
    WriteFile {
        path: String,
        content: String,
        request_id: Option<String>,
    },
    UploadStart {
        transfer_id: String,
        remote_path: String,
        file_size: i64,
        request_id: Option<String>,
    },
    UploadChunk {
        transfer_id: String,
        chunk: String,
        #[allow(dead_code)]
        request_id: Option<String>,
    },
    UploadEnd {
        transfer_id: String,
        request_id: Option<String>,
    },
    DownloadStart {
        transfer_id: String,
        remote_path: String,
        request_id: Option<String>,
    },
    DownloadCancel {
        transfer_id: String,
    },
    Chmod {
        path: String,
        mode: u32,
        recursive: bool,
        request_id: Option<String>,
    },
    Touch {
        path: String,
        is_dir: bool,
        request_id: Option<String>,
    },
    Exec {
        command: String,
        request_id: Option<String>,
    },
    Disconnect,
}

/* ── SFTP 辅助函数 ── */

fn sftp_mode_to_permissions(mode: u32) -> String {
    let perms = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
    let owner = perms[((mode >> 6) & 7) as usize];
    let group = perms[((mode >> 3) & 7) as usize];
    let other = perms[(mode & 7) as usize];
    format!("{}{}{}", owner, group, other)
}

fn sftp_type_from_meta(meta: &Metadata) -> &'static str {
    if meta.is_dir() {
        "dir"
    } else if meta.is_regular() {
        "file"
    } else {
        "symlink"
    }
}

fn sftp_entry_from_meta(path: &str, meta: &Metadata) -> Value {
    let name = path.rsplit('/').next().unwrap_or(path).to_string();
    let mtime = meta.mtime.unwrap_or(0) as i64;
    let modified_at = chrono::DateTime::<Utc>::from_timestamp(mtime, 0)
        .unwrap_or_else(|| chrono::DateTime::<Utc>::from_timestamp(0, 0).unwrap())
        .to_rfc3339();
    let perm = meta.permissions.unwrap_or(0);
    json!({
        "name": name, "path": path,
        "type": sftp_type_from_meta(meta),
        "size": meta.size.unwrap_or(0) as i64,
        "modifiedAt": modified_at,
        "permissions": sftp_mode_to_permissions(perm & 0o777),
        "owner": meta.uid.unwrap_or(0),
        "group": meta.gid.unwrap_or(0),
    })
}

fn send_worker_ok(
    event_tx: &tokio_mpsc::UnboundedSender<Value>,
    typ: &str,
    data: Value,
    request_id: Option<String>,
) {
    let mut payload = json!({ "type": typ, "data": data });
    if let Some(rid) = request_id {
        payload["requestId"] = Value::String(rid);
    }
    let _ = event_tx.send(payload);
}

fn send_worker_error(
    event_tx: &tokio_mpsc::UnboundedSender<Value>,
    typ: &str,
    message: String,
    request_id: Option<String>,
) {
    let mut payload = json!({ "type": typ, "data": { "message": message } });
    if let Some(rid) = request_id {
        payload["requestId"] = Value::String(rid);
    }
    let _ = event_tx.send(payload);
}

async fn read_text_file(sftp: &SftpSession, path: &str) -> Result<String, String> {
    let meta = sftp.metadata(path).await.map_err(|e| e.to_string())?;
    let size = meta.size.unwrap_or(0);
    if size > 10 * 1024 * 1024 {
        return Err(format!(
            "文件过大（{}MB），最大允许 10MB",
            (size as f64 / 1024.0 / 1024.0).ceil()
        ));
    }
    let mut file = sftp.open(path).await.map_err(|e| e.to_string())?;
    let mut content = Vec::new();
    file.read_to_end(&mut content)
        .await
        .map_err(|e| e.to_string())?;
    String::from_utf8(content).map_err(|e| format!("UTF-8 解析失败: {}", e))
}

async fn write_text_file(sftp: &SftpSession, path: &str, content: &str) -> Result<(), String> {
    let mut file = sftp.create(path).await.map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    file.shutdown().await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn remove_dir_recursive(sftp: &SftpSession, path: &str) -> Result<(), String> {
    let entries = sftp.read_dir(path).await.map_err(|e| e.to_string())?;
    for entry in entries {
        let name = entry.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let full = format!("{}/{}", path.trim_end_matches('/'), name);
        if entry.metadata().is_dir() {
            Box::pin(remove_dir_recursive(sftp, &full)).await?;
        } else {
            sftp.remove_file(&full).await.map_err(|e| e.to_string())?;
        }
    }
    sftp.remove_dir(path).await.map_err(|e| e.to_string())?;
    Ok(())
}

async fn set_perm(sftp: &SftpSession, path: &str, mode: u32) -> Result<(), String> {
    let mut meta = Metadata::default();
    meta.permissions = Some(mode);
    sftp.set_metadata(path, meta)
        .await
        .map_err(|e| e.to_string())
}

async fn chmod_recursive(sftp: &SftpSession, path: &str, mode: u32) -> Result<(), String> {
    set_perm(sftp, path, mode).await?;
    let entries = sftp.read_dir(path).await.map_err(|e| e.to_string())?;
    for entry in entries {
        let name = entry.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let full = format!("{}/{}", path.trim_end_matches('/'), name);
        if entry.metadata().is_dir() {
            Box::pin(chmod_recursive(sftp, &full, mode)).await?;
        } else {
            set_perm(sftp, &full, mode).await?;
        }
    }
    Ok(())
}

async fn compute_dir_size(
    sftp: &SftpSession,
    path: &str,
    visited: &mut HashMap<String, bool>,
) -> Result<i64, String> {
    if visited.contains_key(path) {
        return Ok(0);
    }
    visited.insert(path.to_string(), true);
    let mut total = 0i64;
    let entries = sftp.read_dir(path).await.map_err(|e| e.to_string())?;
    for entry in entries {
        let name = entry.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let full = format!("{}/{}", path.trim_end_matches('/'), name);
        if entry.metadata().is_dir() {
            total += Box::pin(compute_dir_size(sftp, &full, visited)).await?;
        } else {
            total += entry.metadata().size.unwrap_or(0) as i64;
        }
    }
    Ok(total)
}

/* ── WsMessage -> WorkerReq 转换 ── */

pub fn build_worker_req(msg: &WsMessage) -> Option<WorkerReq> {
    let data = msg.data.as_ref()?;
    match msg.r#type.as_str() {
        "sftp-list" => Some(WorkerReq::List {
            path: data.get("path")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        "sftp-stat" => Some(WorkerReq::Stat {
            path: data.get("path")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        "sftp-mkdir" => Some(WorkerReq::Mkdir {
            path: data.get("path")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        "sftp-rename" => Some(WorkerReq::Rename {
            old_path: data.get("oldPath")?.as_str()?.to_string(),
            new_path: data.get("newPath")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        "sftp-delete" => Some(WorkerReq::Delete {
            path: data.get("path")?.as_str()?.to_string(),
            is_dir: data.get("isDir")?.as_bool()?,
            request_id: msg.request_id.clone(),
        }),
        "sftp-read-file" => Some(WorkerReq::ReadFile {
            path: data.get("path")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        "sftp-write-file" => Some(WorkerReq::WriteFile {
            path: data.get("path")?.as_str()?.to_string(),
            content: data.get("content")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        "sftp-upload-start" => Some(WorkerReq::UploadStart {
            transfer_id: data.get("transferId")?.as_str()?.to_string(),
            remote_path: data.get("remotePath")?.as_str()?.to_string(),
            file_size: data.get("fileSize")?.as_i64()?,
            request_id: msg.request_id.clone(),
        }),
        "sftp-upload-chunk" => Some(WorkerReq::UploadChunk {
            transfer_id: data.get("transferId")?.as_str()?.to_string(),
            chunk: data.get("chunk")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        "sftp-upload-end" => Some(WorkerReq::UploadEnd {
            transfer_id: data.get("transferId")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        "sftp-download-start" => Some(WorkerReq::DownloadStart {
            transfer_id: data.get("transferId")?.as_str()?.to_string(),
            remote_path: data.get("remotePath")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        "sftp-download-cancel" => Some(WorkerReq::DownloadCancel {
            transfer_id: data.get("transferId")?.as_str()?.to_string(),
        }),
        "sftp-chmod" => {
            let mode = u32::from_str_radix(data.get("mode")?.as_str()?, 8).ok()?;
            Some(WorkerReq::Chmod {
                path: data.get("path")?.as_str()?.to_string(),
                mode,
                recursive: data
                    .get("recursive")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                request_id: msg.request_id.clone(),
            })
        }
        "sftp-touch" => Some(WorkerReq::Touch {
            path: data.get("path")?.as_str()?.to_string(),
            is_dir: data.get("isDir").and_then(|v| v.as_bool()).unwrap_or(false),
            request_id: msg.request_id.clone(),
        }),
        "sftp-exec" => Some(WorkerReq::Exec {
            command: data.get("command")?.as_str()?.to_string(),
            request_id: msg.request_id.clone(),
        }),
        _ => None,
    }
}

/* ── Worker 启动 ── */

fn emit_hostkey_prompt(
    event_tx: &tokio_mpsc::UnboundedSender<Value>,
    prompt: &HostKeyVerificationPrompt,
    request_id: &str,
) {
    let mut payload = json!({
        "requestId": request_id,
        "reason": prompt.reason,
        "host": prompt.host,
        "port": prompt.port,
        "username": prompt.username,
        "connectionId": prompt.connection_id,
        "connectionName": prompt.connection_name,
        "keyType": prompt.key_type,
        "fingerprintSha256": prompt.fingerprint_sha256,
    });

    if let Some(known_key_type) = &prompt.known_key_type {
        payload["knownKeyType"] = Value::String(known_key_type.clone());
    }
    if let Some(known_fingerprint) = &prompt.known_fingerprint_sha256 {
        payload["knownFingerprintSha256"] = Value::String(known_fingerprint.clone());
    }

    let _ = event_tx.send(json!({
        "type": "hostkey-verification-required",
        "data": payload,
    }));
}

async fn wait_for_hostkey_decision(
    hostkey_rx: &mut tokio_mpsc::UnboundedReceiver<HostKeyDecision>,
    request_id: &str,
) -> Option<HostKeyDecision> {
    while let Some(decision) = hostkey_rx.recv().await {
        if decision.request_id == request_id {
            return Some(decision);
        }
    }
    None
}

pub fn start_sftp_worker(
    connect: Value,
    event_tx: tokio_mpsc::UnboundedSender<Value>,
    known_hosts_path: PathBuf,
) -> Result<SftpWorker, String> {
    let data = connect
        .as_object()
        .ok_or_else(|| "连接数据无效".to_string())?;
    let host = data
        .get("host")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "缺少主机".to_string())?
        .to_string();
    let username = data
        .get("username")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "缺少用户名".to_string())?
        .to_string();
    let port = data.get("port").and_then(|v| v.as_i64()).unwrap_or(22) as u16;
    let password = data
        .get("password")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let private_key = data
        .get("privateKey")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let passphrase = data
        .get("passphrase")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let connection_id = data
        .get("connectionId")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let connection_name = data
        .get("connectionName")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
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
                establish_russh_session_via_jump(
                    &endpoint,
                    known_hosts_path.clone(),
                    connect_decision,
                    jump_config,
                    jump_decision,
                )
                .await
                .map(|session| session.handle)
            } else {
                establish_russh_session_with_context(
                    &endpoint,
                    known_hosts_path.clone(),
                    connect_decision,
                )
                .await
            };

            match connect_result {
                Ok(session) => break session,
                Err(EstablishRusshSessionError::HostKeyVerificationRequired(prompt)) => {
                    let request_id = Uuid::new_v4().to_string();
                    emit_hostkey_prompt(&event_tx, &prompt, &request_id);

                    let Some(decision) =
                        wait_for_hostkey_decision(&mut hostkey_rx, &request_id).await
                    else {
                        let _ = event_tx.send(json!({
                            "type": "sftp-error",
                            "data": { "message": "SSH host identity verification was interrupted." }
                        }));
                        return;
                    };

                    if !decision.trust {
                        let _ = event_tx.send(json!({
                            "type": "sftp-error",
                            "data": { "message": "SSH host trust was rejected." }
                        }));
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
                    let _ = event_tx.send(json!({
                        "type": "sftp-error",
                        "data": { "message": format!("Connection failed: {}", e) }
                    }));
                    return;
                }
            }
        };

        let auth_result = if let Some(pk) = private_key.clone() {
            match russh::keys::decode_secret_key(&pk, passphrase.as_deref()) {
                Ok(key_pair) => match handle.best_supported_rsa_hash().await {
                    Ok(hash) => {
                        let h = hash.flatten();
                        handle
                            .authenticate_publickey(
                                &username,
                                PrivateKeyWithHashAlg::new(Arc::new(key_pair), h),
                            )
                            .await
                            .map_err(|e| e.to_string())
                    }
                    Err(e) => Err(e.to_string()),
                },
                Err(e) => Err(format!("私钥解析失败: {}", e)),
            }
        } else if let Some(pwd) = password.clone() {
            handle
                .authenticate_password(&username, &pwd)
                .await
                .map_err(|e| e.to_string())
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
            let _ =
                event_tx.send(json!({ "type": "sftp-error", "data": { "message": "认证失败" } }));
            return;
        }

        // 打开 SFTP 通道
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

        // SFTP 初始化
        let sftp = match SftpSession::new(channel.into_stream()).await {
            Ok(s) => s,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": format!("SFTP 会话初始化失败: {}", e) } }));
                return;
            }
        };

        let home = sftp
            .canonicalize(".")
            .await
            .unwrap_or_else(|_| "/".to_string());
        let _ = event_tx.send(json!({ "type": "sftp-ready", "data": { "home": home } }));

        sftp_main_loop(sftp, &mut rx, &event_tx).await;
    });

    Ok(SftpWorker { tx, hostkey_tx })
}

/* ── SFTP 主循环 ── */

async fn sftp_main_loop(
    sftp: SftpSession,
    rx: &mut tokio_mpsc::UnboundedReceiver<WorkerReq>,
    event_tx: &tokio_mpsc::UnboundedSender<Value>,
) {
    struct UploadSession {
        file: File,
        bytes: i64,
        file_size: i64,
        remote_path: String,
    }

    let mut upload_sessions: HashMap<String, UploadSession> = HashMap::new();
    let mut download_cancel: HashMap<String, bool> = HashMap::new();
    let mut dir_size_cache: HashMap<String, (i64, i64)> = HashMap::new();

    while let Some(req) = rx.recv().await {
        match req {
            WorkerReq::Disconnect => break,
            WorkerReq::List { path, request_id } => match sftp.read_dir(&path).await {
                Ok(list) => {
                    let mut entries = Vec::new();
                    let mut pending = Vec::new();
                    for entry in list {
                        let file_name = entry.file_name();
                        if file_name == "." || file_name == ".." {
                            continue;
                        }
                        let full_path = format!("{}/{}", path.trim_end_matches('/'), file_name);
                        let metadata = entry.metadata();
                        let mut sftp_entry = sftp_entry_from_meta(&full_path, &metadata);
                        if metadata.is_dir() {
                            if let Some((size, at)) = dir_size_cache.get(&full_path) {
                                if Utc::now().timestamp() - *at < 300 {
                                    sftp_entry["size"] = Value::Number((*size).into());
                                } else {
                                    sftp_entry["size"] = Value::Number((-1).into());
                                    pending.push(full_path.clone());
                                }
                            } else {
                                sftp_entry["size"] = Value::Number((-1).into());
                                pending.push(full_path.clone());
                            }
                        }
                        entries.push(sftp_entry);
                    }
                    let mut payload = json!({ "type": "sftp-list-result", "data": { "path": path, "entries": entries } });
                    if let Some(rid) = request_id.clone() {
                        payload["requestId"] = Value::String(rid);
                    }
                    let _ = event_tx.send(payload);

                    for dir in pending {
                        if let Ok(size) = compute_dir_size(&sftp, &dir, &mut HashMap::new()).await {
                            dir_size_cache.insert(dir.clone(), (size, Utc::now().timestamp()));
                            let _ = event_tx.send(json!({ "type": "sftp-dir-size", "data": { "path": dir, "size": size } }));
                        }
                    }
                }
                Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
            },
            WorkerReq::Stat { path, request_id } => match sftp.metadata(&path).await {
                Ok(meta) => {
                    let entry = sftp_entry_from_meta(&path, &meta);
                    let mut payload = json!({ "type": "sftp-stat-result", "data": entry });
                    if let Some(rid) = request_id {
                        payload["requestId"] = Value::String(rid);
                    }
                    let _ = event_tx.send(payload);
                }
                Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
            },
            WorkerReq::Mkdir { path, request_id } => match sftp.create_dir(&path).await {
                Ok(_) => send_worker_ok(
                    event_tx,
                    "sftp-mkdir-ok",
                    json!({ "path": path }),
                    request_id,
                ),
                Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
            },
            WorkerReq::Rename {
                old_path,
                new_path,
                request_id,
            } => match sftp.rename(&old_path, &new_path).await {
                Ok(_) => send_worker_ok(
                    event_tx,
                    "sftp-rename-ok",
                    json!({ "oldPath": old_path, "newPath": new_path }),
                    request_id,
                ),
                Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
            },
            WorkerReq::Delete {
                path,
                is_dir,
                request_id,
            } => {
                let result = if is_dir {
                    remove_dir_recursive(&sftp, &path).await
                } else {
                    sftp.remove_file(&path).await.map_err(|e| e.to_string())
                };
                match result {
                    Ok(_) => send_worker_ok(
                        event_tx,
                        "sftp-delete-ok",
                        json!({ "path": path }),
                        request_id,
                    ),
                    Err(e) => {
                        send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id)
                    }
                }
            }
            WorkerReq::ReadFile { path, request_id } => match read_text_file(&sftp, &path).await {
                Ok(content) => {
                    let mut payload = json!({ "type": "sftp-read-file-result", "data": { "path": path, "content": content } });
                    if let Some(rid) = request_id {
                        payload["requestId"] = Value::String(rid);
                    }
                    let _ = event_tx.send(payload);
                }
                Err(e) => send_worker_error(event_tx, "sftp-error", e, request_id),
            },
            WorkerReq::WriteFile {
                path,
                content,
                request_id,
            } => match write_text_file(&sftp, &path, &content).await {
                Ok(_) => send_worker_ok(
                    event_tx,
                    "sftp-write-file-ok",
                    json!({ "path": path }),
                    request_id,
                ),
                Err(e) => send_worker_error(event_tx, "sftp-error", e, request_id),
            },
            WorkerReq::UploadStart {
                transfer_id,
                remote_path,
                file_size,
                request_id,
            } => match sftp.create(&remote_path).await {
                Ok(file) => {
                    upload_sessions.insert(
                        transfer_id.clone(),
                        UploadSession {
                            file,
                            bytes: 0,
                            file_size,
                            remote_path: remote_path.clone(),
                        },
                    );
                }
                Err(e) => send_worker_error(
                    event_tx,
                    "sftp-error",
                    format!("上传失败: {}", e),
                    request_id,
                ),
            },
            WorkerReq::UploadChunk {
                transfer_id,
                chunk,
                request_id: _,
            } => {
                if let Some(session) = upload_sessions.get_mut(&transfer_id) {
                    if let Ok(bytes) = BASE64_STD.decode(chunk) {
                        let _ = session.file.write_all(&bytes).await;
                        session.bytes += bytes.len() as i64;
                        let _ = event_tx.send(json!({
                            "type": "sftp-upload-progress",
                            "data": { "transferId": transfer_id, "bytesTransferred": session.bytes, "fileSize": session.file_size }
                        }));
                    }
                }
            }
            WorkerReq::UploadEnd {
                transfer_id,
                request_id,
            } => {
                if let Some(mut session) = upload_sessions.remove(&transfer_id) {
                    let _ = session.file.shutdown().await;
                    send_worker_ok(
                        event_tx,
                        "sftp-upload-ok",
                        json!({
                            "transferId": transfer_id, "remotePath": session.remote_path, "bytesTransferred": session.bytes
                        }),
                        request_id,
                    );
                } else {
                    send_worker_ok(
                        event_tx,
                        "sftp-upload-ok",
                        json!({ "transferId": transfer_id }),
                        request_id,
                    );
                }
            }
            WorkerReq::DownloadStart {
                transfer_id,
                remote_path,
                request_id,
            } => match sftp.open(&remote_path).await {
                Ok(mut file) => {
                    let meta = sftp.metadata(&remote_path).await.ok();
                    let file_size = meta.and_then(|m| m.size).unwrap_or(0) as i64;
                    let file_name = remote_path
                        .rsplit('/')
                        .next()
                        .unwrap_or(&remote_path)
                        .to_string();
                    let mut buffer = vec![0u8; 64 * 1024];
                    let mut transferred = 0i64;
                    loop {
                        if *download_cancel.get(&transfer_id).unwrap_or(&false) {
                            break;
                        }
                        let read = match file.read(&mut buffer).await {
                            Ok(0) => break,
                            Ok(n) => n,
                            Err(_) => break,
                        };
                        transferred += read as i64;
                        let chunk_b64 = BASE64_STD.encode(&buffer[..read]);
                        let _ = event_tx.send(json!({
                                "type": "sftp-download-chunk",
                                "data": { "transferId": transfer_id, "chunk": chunk_b64, "bytesTransferred": transferred, "fileSize": file_size, "fileName": file_name }
                            }));
                    }
                    if !*download_cancel.get(&transfer_id).unwrap_or(&false) {
                        send_worker_ok(
                            event_tx,
                            "sftp-download-ok",
                            json!({ "transferId": transfer_id, "remotePath": remote_path, "bytesTransferred": transferred }),
                            request_id,
                        );
                    }
                    download_cancel.remove(&transfer_id);
                }
                Err(e) => send_worker_error(
                    event_tx,
                    "sftp-error",
                    format!("下载失败: {}", e),
                    request_id,
                ),
            },
            WorkerReq::DownloadCancel { transfer_id } => {
                download_cancel.insert(transfer_id, true);
            }
            WorkerReq::Chmod {
                path,
                mode,
                recursive,
                request_id,
            } => {
                let result = if recursive {
                    Box::pin(chmod_recursive(&sftp, &path, mode)).await
                } else {
                    set_perm(&sftp, &path, mode).await
                };
                match result {
                    Ok(_) => send_worker_ok(
                        event_tx,
                        "sftp-chmod-ok",
                        json!({ "path": path, "mode": format!("{:o}", mode) }),
                        request_id,
                    ),
                    Err(e) => {
                        send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id)
                    }
                }
            }
            WorkerReq::Touch {
                path,
                is_dir,
                request_id,
            } => {
                let result = if is_dir {
                    sftp.create_dir(&path).await.map_err(|e| e.to_string())
                } else {
                    sftp.create(&path)
                        .await
                        .map(|_| ())
                        .map_err(|e| e.to_string())
                };
                match result {
                    Ok(_) => send_worker_ok(
                        event_tx,
                        "sftp-touch-ok",
                        json!({ "path": path, "isDir": is_dir }),
                        request_id,
                    ),
                    Err(e) => {
                        send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id)
                    }
                }
            }
            WorkerReq::Exec {
                command,
                request_id,
            } => {
                send_worker_error(
                    event_tx,
                    "sftp-error",
                    format!("SFTP 模式暂不支持命令执行: {}", command),
                    request_id,
                );
            }
        }
    }
}

fn endpoint_matches_prompt(endpoint: &RusshEndpoint, prompt: &HostKeyVerificationPrompt) -> bool {
    endpoint.host == prompt.host
        && endpoint.port == prompt.port
        && endpoint.username == prompt.username
        && endpoint.connection_id == prompt.connection_id
}

fn parse_jump_config(
    data: &serde_json::Map<String, Value>,
) -> Result<Option<RusshJumpHostConfig>, String> {
    let Some(jump) = data.get("jump") else {
        return Ok(None);
    };
    let Some(jump) = jump.as_object() else {
        return Err("Invalid jump configuration".to_string());
    };

    let host = jump
        .get("host")
        .and_then(|v| v.as_str())
        .ok_or("Missing jump host")?
        .to_string();
    let username = jump
        .get("username")
        .and_then(|v| v.as_str())
        .ok_or("Missing jump username")?
        .to_string();
    let port = jump.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;

    Ok(Some(RusshJumpHostConfig {
        endpoint: RusshEndpoint {
            host,
            port,
            username,
            connection_id: jump
                .get("connectionId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            connection_name: jump
                .get("connectionName")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        },
        auth: RusshAuthConfig {
            password: jump
                .get("password")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            private_key: jump
                .get("privateKey")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            passphrase: jump
                .get("passphrase")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        },
    }))
}
