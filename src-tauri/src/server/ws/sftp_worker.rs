/* ── SFTP Worker ── */

use base64::engine::general_purpose::STANDARD as BASE64_STD;
use base64::Engine;
use chrono::Utc;
use serde_json::{json, Value};
use ssh2::{FileStat, Session, Sftp};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream as StdTcpStream;
use std::sync::mpsc;
use std::thread;

use crate::server::helpers::userauth_pubkey_with_tempfile;
use super::WsMessage;

/* ── 类型 ── */

#[derive(Clone)]
pub struct SftpWorker {
    pub tx: mpsc::Sender<WorkerReq>,
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
    UploadChunk { transfer_id: String, chunk: String, request_id: Option<String> },
    UploadEnd { transfer_id: String, request_id: Option<String> },
    DownloadStart { transfer_id: String, remote_path: String, request_id: Option<String> },
    DownloadCancel { transfer_id: String },
    Chmod { path: String, mode: u32, recursive: bool, request_id: Option<String> },
    Touch { path: String, is_dir: bool, request_id: Option<String> },
    Exec { command: String, request_id: Option<String> },
    Disconnect,
}

const SFTP_ALLOWED_COMMANDS: [&str; 14] = [
    "cp", "mv", "tar", "zip", "unzip", "gzip", "gunzip",
    "chmod", "chown", "ln", "cat", "du", "df", "pwd",
];

/* ── SFTP 辅助函数 ── */

fn sftp_mode_to_permissions(mode: u32) -> String {
    let perms = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
    let owner = perms[((mode >> 6) & 7) as usize];
    let group = perms[((mode >> 3) & 7) as usize];
    let other = perms[(mode & 7) as usize];
    format!("{}{}{}", owner, group, other)
}

fn sftp_type_from_perm(perm: Option<u32>) -> &'static str {
    let mode = perm.unwrap_or(0);
    if mode & 0o120000 == 0o120000 { "symlink" }
    else if mode & 0o040000 == 0o040000 { "dir" }
    else { "file" }
}

fn sftp_entry_from_stat(path: &str, stat: &FileStat) -> Value {
    let name = path.rsplit('/').next().unwrap_or(path).to_string();
    let mtime = stat.mtime.unwrap_or(0) as i64;
    let modified_at = chrono::DateTime::<Utc>::from_timestamp(mtime, 0)
        .unwrap_or_else(|| chrono::DateTime::<Utc>::from_timestamp(0, 0).unwrap())
        .to_rfc3339();
    let perm = stat.perm.unwrap_or(0);
    json!({
        "name": name, "path": path,
        "type": sftp_type_from_perm(stat.perm),
        "size": stat.size.unwrap_or(0) as i64,
        "modifiedAt": modified_at,
        "permissions": sftp_mode_to_permissions(perm & 0o777),
        "owner": stat.uid.unwrap_or(0),
        "group": stat.gid.unwrap_or(0),
    })
}

fn send_worker_ok(event_tx: &tokio::sync::mpsc::UnboundedSender<Value>, typ: &str, data: Value, request_id: Option<String>) {
    let mut payload = json!({ "type": typ, "data": data });
    if let Some(rid) = request_id { payload["requestId"] = Value::String(rid); }
    let _ = event_tx.send(payload);
}

fn send_worker_error(event_tx: &tokio::sync::mpsc::UnboundedSender<Value>, typ: &str, message: String, request_id: Option<String>) {
    let mut payload = json!({ "type": typ, "data": { "message": message } });
    if let Some(rid) = request_id { payload["requestId"] = Value::String(rid); }
    let _ = event_tx.send(payload);
}

fn read_text_file(sftp: &Sftp, path: &str) -> Result<String, String> {
    let stat = sftp.stat(std::path::Path::new(path)).map_err(|e| e.to_string())?;
    let size = stat.size.unwrap_or(0);
    if size > 10 * 1024 * 1024 {
        return Err(format!("文件过大（{}MB），最大允许 10MB", (size as f64 / 1024.0 / 1024.0).ceil()));
    }
    let mut file = sftp.open(std::path::Path::new(path)).map_err(|e| e.to_string())?;
    let mut content = String::new();
    file.read_to_string(&mut content).map_err(|e| e.to_string())?;
    Ok(content)
}

fn write_text_file(sftp: &Sftp, path: &str, content: &str) -> Result<(), String> {
    let mut file = sftp.create(std::path::Path::new(path)).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

fn remove_dir_recursive(sftp: &Sftp, path: &str) -> Result<(), ssh2::Error> {
    let entries = sftp.readdir(std::path::Path::new(path))?;
    for (entry_path, stat) in entries {
        let name = entry_path.file_name().and_then(|v| v.to_str()).unwrap_or("");
        if name == "." || name == ".." { continue; }
        let full = entry_path.to_string_lossy().to_string();
        if sftp_type_from_perm(stat.perm) == "dir" {
            remove_dir_recursive(sftp, &full)?;
        } else {
            sftp.unlink(std::path::Path::new(&full))?;
        }
    }
    sftp.rmdir(std::path::Path::new(path))?;
    Ok(())
}

fn set_perm(sftp: &Sftp, path: &str, mode: u32) -> Result<(), ssh2::Error> {
    let stat = FileStat { size: None, uid: None, gid: None, perm: Some(mode), atime: None, mtime: None };
    sftp.setstat(std::path::Path::new(path), stat)?;
    Ok(())
}

fn chmod_recursive(sftp: &Sftp, path: &str, mode: u32) -> Result<(), ssh2::Error> {
    set_perm(sftp, path, mode)?;
    let entries = sftp.readdir(std::path::Path::new(path))?;
    for (entry_path, stat) in entries {
        let name = entry_path.file_name().and_then(|v| v.to_str()).unwrap_or("");
        if name == "." || name == ".." { continue; }
        let full = entry_path.to_string_lossy().to_string();
        if sftp_type_from_perm(stat.perm) == "dir" {
            chmod_recursive(sftp, &full, mode)?;
        } else {
            set_perm(sftp, &full, mode)?;
        }
    }
    Ok(())
}

fn compute_dir_size(sftp: &Sftp, path: &str, visited: &mut HashMap<String, bool>) -> Result<i64, ssh2::Error> {
    if visited.contains_key(path) { return Ok(0); }
    visited.insert(path.to_string(), true);
    let mut total = 0i64;
    let entries = sftp.readdir(std::path::Path::new(path))?;
    for (entry_path, stat) in entries {
        let name = entry_path.file_name().and_then(|v| v.to_str()).unwrap_or("");
        if name == "." || name == ".." { continue; }
        let full = entry_path.to_string_lossy().to_string();
        if sftp_type_from_perm(stat.perm) == "dir" {
            total += compute_dir_size(sftp, &full, visited)?;
        } else {
            total += stat.size.unwrap_or(0) as i64;
        }
    }
    Ok(total)
}

/* ── WsMessage -> WorkerReq 转换 ── */

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
        "sftp-download-cancel" => Some(WorkerReq::DownloadCancel {
            transfer_id: data.get("transferId")?.as_str()?.to_string(),
        }),
        "sftp-chmod" => {
            let mode = u32::from_str_radix(data.get("mode")?.as_str()?, 8).ok()?;
            Some(WorkerReq::Chmod {
                path: data.get("path")?.as_str()?.to_string(),
                mode, recursive: data.get("recursive").and_then(|v| v.as_bool()).unwrap_or(false),
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

pub fn start_sftp_worker(
    connect: Value,
    event_tx: tokio::sync::mpsc::UnboundedSender<Value>,
) -> Result<SftpWorker, String> {
    let data = connect.as_object().ok_or_else(|| "连接数据无效".to_string())?;
    let host = data.get("host").and_then(|v| v.as_str()).ok_or_else(|| "缺少主机".to_string())?.to_string();
    let username = data.get("username").and_then(|v| v.as_str()).ok_or_else(|| "缺少用户名".to_string())?.to_string();
    let port = data.get("port").and_then(|v| v.as_i64()).unwrap_or(22) as u16;
    let password = data.get("password").and_then(|v| v.as_str()).map(|v| v.to_string());
    let private_key = data.get("privateKey").and_then(|v| v.as_str()).map(|v| v.to_string());
    let passphrase = data.get("passphrase").and_then(|v| v.as_str()).map(|v| v.to_string());

    let (tx, rx) = mpsc::channel::<WorkerReq>();

    thread::spawn(move || {
        let addr = format!("{}:{}", host, port);
        let tcp = match StdTcpStream::connect(addr) {
            Ok(t) => t,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": format!("SFTP 连接失败: {}", e) } }));
                return;
            }
        };
        let mut session = match Session::new() {
            Ok(s) => s,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": format!("无法初始化 SSH 会话: {}", e) } }));
                return;
            }
        };
        session.set_tcp_stream(tcp);
        if let Err(e) = session.handshake() {
            let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": format!("SSH 握手失败: {}", e) } }));
            return;
        }

        let auth_ok = if let Some(pk) = private_key.clone() {
            userauth_pubkey_with_tempfile(&session, &username, &pk, passphrase.as_deref()).is_ok()
        } else if let Some(pwd) = password.clone() {
            session.userauth_password(&username, &pwd).is_ok()
        } else {
            false
        };
        if !auth_ok {
            let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": "认证失败" } }));
            return;
        }

        let sftp = match session.sftp() {
            Ok(s) => s,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "sftp-error", "data": { "message": format!("SFTP 初始化失败: {}", e) } }));
                return;
            }
        };

        let home = sftp.realpath(std::path::Path::new(".")).ok()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string());
        let _ = event_tx.send(json!({ "type": "sftp-ready", "data": { "home": home } }));

        sftp_main_loop(&session, &sftp, &rx, &event_tx);
    });

    Ok(SftpWorker { tx })
}

/* ── SFTP 主循环 ── */

fn sftp_main_loop(
    session: &Session,
    sftp: &Sftp,
    rx: &mpsc::Receiver<WorkerReq>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
) {
    struct UploadSession {
        file: ssh2::File,
        bytes: i64,
        file_size: i64,
        remote_path: String,
    }

    let mut upload_sessions: HashMap<String, UploadSession> = HashMap::new();
    let mut download_cancel: HashMap<String, bool> = HashMap::new();
    let mut dir_size_cache: HashMap<String, (i64, i64)> = HashMap::new();

    while let Ok(req) = rx.recv() {
        match req {
            WorkerReq::Disconnect => break,
            WorkerReq::List { path, request_id } => {
                match sftp.readdir(std::path::Path::new(&path)) {
                    Ok(list) => {
                        let mut entries = Vec::new();
                        let mut pending = Vec::new();
                        for (p, stat) in list {
                            let file_name = p.file_name().and_then(|v| v.to_str()).unwrap_or("").to_string();
                            if file_name == "." || file_name == ".." { continue; }
                            let full_path = if path == "/" { format!("/{}", file_name) } else { format!("{}/{}", path, file_name) };
                            let mut entry = sftp_entry_from_stat(&full_path, &stat);
                            if sftp_type_from_perm(stat.perm) == "dir" {
                                if let Some((size, at)) = dir_size_cache.get(&full_path) {
                                    if Utc::now().timestamp() - *at < 300 {
                                        entry["size"] = Value::Number((*size).into());
                                    } else {
                                        entry["size"] = Value::Number((-1).into());
                                        pending.push(full_path.clone());
                                    }
                                } else {
                                    entry["size"] = Value::Number((-1).into());
                                    pending.push(full_path.clone());
                                }
                            }
                            entries.push(entry);
                        }
                        let mut payload = json!({ "type": "sftp-list-result", "data": { "path": path, "entries": entries } });
                        if let Some(rid) = request_id.clone() { payload["requestId"] = Value::String(rid); }
                        let _ = event_tx.send(payload);

                        for dir in pending {
                            if let Ok(size) = compute_dir_size(sftp, &dir, &mut HashMap::new()) {
                                dir_size_cache.insert(dir.clone(), (size, Utc::now().timestamp()));
                                let _ = event_tx.send(json!({ "type": "sftp-dir-size", "data": { "path": dir, "size": size } }));
                            }
                        }
                    }
                    Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
                }
            }
            WorkerReq::Stat { path, request_id } => {
                match sftp.stat(std::path::Path::new(&path)) {
                    Ok(stat) => {
                        let entry = sftp_entry_from_stat(&path, &stat);
                        let mut payload = json!({ "type": "sftp-stat-result", "data": entry });
                        if let Some(rid) = request_id { payload["requestId"] = Value::String(rid); }
                        let _ = event_tx.send(payload);
                    }
                    Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
                }
            }
            WorkerReq::Mkdir { path, request_id } => {
                match sftp.mkdir(std::path::Path::new(&path), 0o755) {
                    Ok(_) => send_worker_ok(event_tx, "sftp-mkdir-ok", json!({ "path": path }), request_id),
                    Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
                }
            }
            WorkerReq::Rename { old_path, new_path, request_id } => {
                match sftp.rename(std::path::Path::new(&old_path), std::path::Path::new(&new_path), None) {
                    Ok(_) => send_worker_ok(event_tx, "sftp-rename-ok", json!({ "oldPath": old_path, "newPath": new_path }), request_id),
                    Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
                }
            }
            WorkerReq::Delete { path, is_dir, request_id } => {
                let result = if is_dir { remove_dir_recursive(sftp, &path) } else { sftp.unlink(std::path::Path::new(&path)).map(|_| ()) };
                match result {
                    Ok(_) => send_worker_ok(event_tx, "sftp-delete-ok", json!({ "path": path }), request_id),
                    Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
                }
            }
            WorkerReq::ReadFile { path, request_id } => {
                match read_text_file(sftp, &path) {
                    Ok(content) => {
                        let mut payload = json!({ "type": "sftp-read-file-result", "data": { "path": path, "content": content } });
                        if let Some(rid) = request_id { payload["requestId"] = Value::String(rid); }
                        let _ = event_tx.send(payload);
                    }
                    Err(e) => send_worker_error(event_tx, "sftp-error", e, request_id),
                }
            }
            WorkerReq::WriteFile { path, content, request_id } => {
                match write_text_file(sftp, &path, &content) {
                    Ok(_) => send_worker_ok(event_tx, "sftp-write-file-ok", json!({ "path": path }), request_id),
                    Err(e) => send_worker_error(event_tx, "sftp-error", e, request_id),
                }
            }
            WorkerReq::UploadStart { transfer_id, remote_path, file_size, request_id } => {
                match sftp.create(std::path::Path::new(&remote_path)) {
                    Ok(file) => {
                        upload_sessions.insert(transfer_id.clone(), UploadSession {
                            file, bytes: 0, file_size, remote_path: remote_path.clone(),
                        });
                        let _ = request_id;
                    }
                    Err(e) => send_worker_error(event_tx, "sftp-error", format!("上传失败: {}", e), request_id),
                }
            }
            WorkerReq::UploadChunk { transfer_id, chunk, request_id: _ } => {
                if let Some(session) = upload_sessions.get_mut(&transfer_id) {
                    if let Ok(bytes) = BASE64_STD.decode(chunk) {
                        let _ = session.file.write_all(&bytes);
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
                    let _ = session.file.flush();
                    send_worker_ok(event_tx, "sftp-upload-ok", json!({
                        "transferId": transfer_id, "remotePath": session.remote_path, "bytesTransferred": session.bytes
                    }), request_id);
                } else {
                    send_worker_ok(event_tx, "sftp-upload-ok", json!({ "transferId": transfer_id }), request_id);
                }
            }
            WorkerReq::DownloadStart { transfer_id, remote_path, request_id } => {
                match sftp.open(std::path::Path::new(&remote_path)) {
                    Ok(mut file) => {
                        let stat = sftp.stat(std::path::Path::new(&remote_path)).ok();
                        let file_size = stat.and_then(|s| s.size).unwrap_or(0) as i64;
                        let file_name = std::path::Path::new(&remote_path).file_name().and_then(|v| v.to_str()).unwrap_or("").to_string();
                        let mut buffer = vec![0u8; 64 * 1024];
                        let mut transferred = 0i64;
                        loop {
                            if *download_cancel.get(&transfer_id).unwrap_or(&false) { break; }
                            let read = match file.read(&mut buffer) {
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
                            send_worker_ok(event_tx, "sftp-download-ok", json!({ "transferId": transfer_id, "remotePath": remote_path, "bytesTransferred": transferred }), request_id);
                        }
                        download_cancel.remove(&transfer_id);
                    }
                    Err(e) => send_worker_error(event_tx, "sftp-error", format!("下载失败: {}", e), request_id),
                }
            }
            WorkerReq::DownloadCancel { transfer_id } => {
                download_cancel.insert(transfer_id, true);
            }
            WorkerReq::Chmod { path, mode, recursive, request_id } => {
                let result = if recursive { chmod_recursive(sftp, &path, mode) } else { set_perm(sftp, &path, mode) };
                match result {
                    Ok(_) => send_worker_ok(event_tx, "sftp-chmod-ok", json!({ "path": path, "mode": format!("{:o}", mode) }), request_id),
                    Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
                }
            }
            WorkerReq::Touch { path, is_dir, request_id } => {
                let result = if is_dir { sftp.mkdir(std::path::Path::new(&path), 0o755).map(|_| ()) } else { sftp.create(std::path::Path::new(&path)).map(|_| ()) };
                match result {
                    Ok(_) => send_worker_ok(event_tx, "sftp-touch-ok", json!({ "path": path, "isDir": is_dir }), request_id),
                    Err(e) => send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id),
                }
            }
            WorkerReq::Exec { command, request_id } => {
                let first = command.split_whitespace().next().unwrap_or("");
                if !SFTP_ALLOWED_COMMANDS.contains(&first) {
                    send_worker_error(event_tx, "sftp-error", format!("命令 \"{}\" 不在白名单中", first), request_id);
                    continue;
                }
                let mut channel = match session.channel_session() {
                    Ok(c) => c,
                    Err(e) => { send_worker_error(event_tx, "sftp-error", format!("{}", e), request_id); continue; }
                };
                if channel.exec(&command).is_err() {
                    send_worker_error(event_tx, "sftp-error", "执行失败".to_string(), request_id);
                    continue;
                }
                let mut stdout = String::new();
                let mut stderr = String::new();
                let _ = channel.read_to_string(&mut stdout);
                let _ = channel.stderr().read_to_string(&mut stderr);
                let code = channel.exit_status().unwrap_or(0);
                send_worker_ok(event_tx, "sftp-exec-result", json!({ "stdout": stdout, "stderr": stderr, "code": code }), request_id);
            }
        }
    }
}
