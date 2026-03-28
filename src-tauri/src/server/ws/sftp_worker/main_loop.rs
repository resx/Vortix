use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64_STD;
use russh_sftp::client::SftpSession;
use russh_sftp::client::fs::File;
use serde_json::{Value, json};
use std::collections::HashMap;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::mpsc as tokio_mpsc;
use sqlx::SqlitePool;

use super::WorkerReq;
use super::events::{send_worker_error, send_worker_ok};
use super::fs_ops::{chmod_entry, read_text_file, remove_dir_recursive, sftp_entry_from_meta, write_text_file};
use crate::db::sftp_dir_cache;
use crate::db::transfer_history::{
    TransferDirection, TransferStatus, append_transfer_history,
};

pub(super) async fn sftp_main_loop(
    sftp: SftpSession,
    rx: &mut tokio_mpsc::UnboundedReceiver<WorkerReq>,
    event_tx: &tokio_mpsc::UnboundedSender<Value>,
    session_key: &str,
    pool: &SqlitePool,
) {
    struct UploadSession {
        file: File,
        bytes: i64,
        file_size: i64,
        remote_path: String,
    }

    let mut upload_sessions: HashMap<String, UploadSession> = HashMap::new();
    let mut download_cancel: HashMap<String, bool> = HashMap::new();
    while let Some(req) = rx.recv().await {
        match req {
            WorkerReq::Disconnect => break,
            WorkerReq::List { path, request_id } => {
                if let Ok(Some(entries)) = sftp_dir_cache::get_cached_listing(pool, session_key, &path).await {
                    let mut payload = json!({ "type": "sftp-list-result", "data": { "path": path, "entries": entries } });
                    if let Some(rid) = request_id.clone() {
                        payload["requestId"] = Value::String(rid);
                    }
                    let _ = event_tx.send(payload);
                }

                match sftp.read_dir(&path).await {
                    Ok(list) => {
                        let mut entries = Vec::new();
                        for entry in list {
                            let file_name = entry.file_name();
                            if file_name == "." || file_name == ".." {
                                continue;
                            }
                            let full_path = format!("{}/{}", path.trim_end_matches('/'), file_name);
                            let metadata = entry.metadata();
                            let mut sftp_entry = sftp_entry_from_meta(&full_path, &metadata);
                            if metadata.is_dir() {
                                sftp_entry["size"] = Value::Number((-1).into());
                            }
                            entries.push(sftp_entry);
                        }
                        let _ = sftp_dir_cache::set_cached_listing(pool, session_key, &path, &entries).await;
                        let _ = sftp_dir_cache::clear_expired(pool).await;
                        let mut payload = json!({ "type": "sftp-list-result", "data": { "path": path, "entries": entries } });
                        if let Some(rid) = request_id.clone() {
                            payload["requestId"] = Value::String(rid);
                        }
                        let _ = event_tx.send(payload);
                    }
                    Err(e) => send_worker_error(event_tx, "sftp-error", e.to_string(), request_id),
                }
            }
            WorkerReq::Stat { path, request_id } => match sftp.metadata(&path).await {
                Ok(meta) => {
                    let entry = sftp_entry_from_meta(&path, &meta);
                    let mut payload = json!({ "type": "sftp-stat-result", "data": entry });
                    if let Some(rid) = request_id {
                        payload["requestId"] = Value::String(rid);
                    }
                    let _ = event_tx.send(payload);
                }
                Err(e) => send_worker_error(event_tx, "sftp-error", e.to_string(), request_id),
            },
            WorkerReq::Mkdir { path, request_id } => match sftp.create_dir(&path).await {
                Ok(_) => {
                    let _ = sftp_dir_cache::invalidate_path_and_parent(pool, session_key, &path).await;
                    send_worker_ok(event_tx, "sftp-mkdir-ok", json!({ "path": path }), request_id)
                }
                Err(e) => send_worker_error(event_tx, "sftp-error", e.to_string(), request_id),
            },
            WorkerReq::Rename { old_path, new_path, request_id } => match sftp.rename(&old_path, &new_path).await {
                Ok(_) => {
                    let _ = sftp_dir_cache::invalidate_rename(pool, session_key, &old_path, &new_path).await;
                    send_worker_ok(event_tx, "sftp-rename-ok", json!({ "oldPath": old_path, "newPath": new_path }), request_id)
                }
                Err(e) => send_worker_error(event_tx, "sftp-error", e.to_string(), request_id),
            },
            WorkerReq::Delete { path, is_dir, request_id } => {
                let result = if is_dir {
                    remove_dir_recursive(&sftp, &path).await
                } else {
                    sftp.remove_file(&path).await.map_err(|e| e.to_string())
                };
                match result {
                    Ok(_) => {
                        let _ = sftp_dir_cache::invalidate_path_and_parent(pool, session_key, &path).await;
                        send_worker_ok(event_tx, "sftp-delete-ok", json!({ "path": path }), request_id)
                    }
                    Err(e) => send_worker_error(event_tx, "sftp-error", e, request_id),
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
            WorkerReq::WriteFile { path, content, request_id } => match write_text_file(&sftp, &path, &content).await {
                Ok(_) => {
                    let _ = sftp_dir_cache::invalidate_path_and_parent(pool, session_key, &path).await;
                    send_worker_ok(event_tx, "sftp-write-file-ok", json!({ "path": path }), request_id)
                }
                Err(e) => send_worker_error(event_tx, "sftp-error", e, request_id),
            },
            WorkerReq::UploadStart { transfer_id, remote_path, file_size, request_id } => match sftp.create(&remote_path).await {
                Ok(file) => {
                    upload_sessions.insert(transfer_id.clone(), UploadSession { file, bytes: 0, file_size, remote_path: remote_path.clone() });
                }
                Err(e) => {
                    let msg = format!("上传失败: {}", e);
                    let _ = append_transfer_history(
                        pool,
                        session_key,
                        &transfer_id,
                        TransferDirection::Upload,
                        &remote_path,
                        0,
                        file_size,
                        TransferStatus::Failed,
                        Some(&msg),
                    )
                    .await;
                    send_worker_error(event_tx, "sftp-error", msg, request_id)
                }
            },
            WorkerReq::UploadChunk { transfer_id, chunk, request_id: _ } => {
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
            WorkerReq::UploadEnd { transfer_id, request_id } => {
                if let Some(mut session) = upload_sessions.remove(&transfer_id) {
                    let _ = session.file.shutdown().await;
                    let _ = sftp_dir_cache::invalidate_path_and_parent(pool, session_key, &session.remote_path).await;
                    let _ = append_transfer_history(
                        pool,
                        session_key,
                        &transfer_id,
                        TransferDirection::Upload,
                        &session.remote_path,
                        session.bytes,
                        session.file_size,
                        TransferStatus::Completed,
                        None,
                    )
                    .await;
                    send_worker_ok(
                        event_tx,
                        "sftp-upload-ok",
                        json!({ "transferId": transfer_id, "remotePath": session.remote_path, "bytesTransferred": session.bytes }),
                        request_id,
                    );
                } else {
                    send_worker_ok(event_tx, "sftp-upload-ok", json!({ "transferId": transfer_id }), request_id);
                }
            }
            WorkerReq::DownloadStart { transfer_id, remote_path, request_id } => match sftp.open(&remote_path).await {
                Ok(mut file) => {
                    let meta = sftp.metadata(&remote_path).await.ok();
                    let file_size = meta.and_then(|m| m.size).unwrap_or(0) as i64;
                    let file_name = remote_path.rsplit('/').next().unwrap_or(&remote_path).to_string();
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
                        let _ = append_transfer_history(
                            pool,
                            session_key,
                            &transfer_id,
                            TransferDirection::Download,
                            &remote_path,
                            transferred,
                            file_size,
                            TransferStatus::Completed,
                            None,
                        )
                        .await;
                        send_worker_ok(
                            event_tx,
                            "sftp-download-ok",
                            json!({ "transferId": transfer_id, "remotePath": remote_path, "bytesTransferred": transferred }),
                            request_id,
                        );
                    } else {
                        let _ = append_transfer_history(
                            pool,
                            session_key,
                            &transfer_id,
                            TransferDirection::Download,
                            &remote_path,
                            transferred,
                            file_size,
                            TransferStatus::Canceled,
                            None,
                        )
                        .await;
                    }
                    download_cancel.remove(&transfer_id);
                }
                Err(e) => {
                    let msg = format!("下载失败: {}", e);
                    let _ = append_transfer_history(
                        pool,
                        session_key,
                        &transfer_id,
                        TransferDirection::Download,
                        &remote_path,
                        0,
                        0,
                        TransferStatus::Failed,
                        Some(&msg),
                    )
                    .await;
                    send_worker_error(event_tx, "sftp-error", msg, request_id)
                }
            },
            WorkerReq::DownloadCancel { transfer_id } => {
                download_cancel.insert(transfer_id, true);
            }
            WorkerReq::Chmod { path, mode, recursive, request_id } => {
                match chmod_entry(&sftp, &path, mode, recursive).await {
                    Ok(_) => send_worker_ok(event_tx, "sftp-chmod-ok", json!({ "path": path, "mode": format!("{:o}", mode) }), request_id),
                    Err(e) => send_worker_error(event_tx, "sftp-error", e, request_id),
                }
            }
            WorkerReq::Touch { path, is_dir, request_id } => {
                let result = if is_dir {
                    sftp.create_dir(&path).await.map_err(|e| e.to_string())
                } else {
                    sftp.create(&path).await.map(|_| ()).map_err(|e| e.to_string())
                };
                match result {
                    Ok(_) => {
                        let _ = sftp_dir_cache::invalidate_path_and_parent(pool, session_key, &path).await;
                        send_worker_ok(event_tx, "sftp-touch-ok", json!({ "path": path, "isDir": is_dir }), request_id)
                    }
                    Err(e) => send_worker_error(event_tx, "sftp-error", e, request_id),
                }
            }
            WorkerReq::Exec { command, request_id } => {
                send_worker_error(event_tx, "sftp-error", format!("SFTP 模式暂不支持命令执行: {}", command), request_id);
            }
        }
    }
}
