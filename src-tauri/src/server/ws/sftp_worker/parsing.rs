use serde_json::Value;

use super::super::WsMessage;
use super::WorkerReq;
use crate::server::helpers::{HostKeyVerificationPrompt, RusshAuthConfig, RusshEndpoint, RusshJumpHostConfig};

pub fn build_worker_req(msg: &WsMessage) -> Option<WorkerReq> {
    let data = msg.data.as_ref()?;
    match msg.r#type.as_str() {
        "sftp-list" => Some(WorkerReq::List { path: data.get("path")?.as_str()?.to_string(), request_id: msg.request_id.clone() }),
        "sftp-stat" => Some(WorkerReq::Stat { path: data.get("path")?.as_str()?.to_string(), request_id: msg.request_id.clone() }),
        "sftp-mkdir" => Some(WorkerReq::Mkdir { path: data.get("path")?.as_str()?.to_string(), request_id: msg.request_id.clone() }),
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
        "sftp-read-file" => Some(WorkerReq::ReadFile { path: data.get("path")?.as_str()?.to_string(), request_id: msg.request_id.clone() }),
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
        "sftp-download-cancel" => {
            Some(WorkerReq::DownloadCancel { transfer_id: data.get("transferId")?.as_str()?.to_string() })
        }
        "sftp-chmod" => {
            let mode = u32::from_str_radix(data.get("mode")?.as_str()?, 8).ok()?;
            Some(WorkerReq::Chmod {
                path: data.get("path")?.as_str()?.to_string(),
                mode,
                recursive: data.get("recursive").and_then(|v| v.as_bool()).unwrap_or(false),
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

pub(super) fn endpoint_matches_prompt(endpoint: &RusshEndpoint, prompt: &HostKeyVerificationPrompt) -> bool {
    endpoint.host == prompt.host
        && endpoint.port == prompt.port
        && endpoint.username == prompt.username
        && endpoint.connection_id == prompt.connection_id
}

pub(super) fn parse_jump_config(
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
