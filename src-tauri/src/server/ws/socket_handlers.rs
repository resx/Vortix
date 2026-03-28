use axum::extract::ws::{Message, WebSocket};
use serde_json::{Value, json};
use tokio::time;
use uuid::Uuid;

use crate::db::Db;

use super::local_pty_worker::{LocalPtyReq, LocalPtyWorker, start_local_pty_worker};
use super::sftp_worker::{SftpWorker, WorkerReq, build_worker_req, start_sftp_worker};
use super::ssh_worker::{HostKeyDecision, SshReq, SshWorker, start_ssh_worker};
use super::WsMessage;

enum TerminalWorker {
    Ssh(SshWorker),
    Local(LocalPtyWorker),
}

pub(super) async fn ws_ssh(mut socket: WebSocket, db: Db) {
    let mut interval = time::interval(std::time::Duration::from_secs(30));
    let (event_tx, mut event_rx) = tokio::sync::mpsc::unbounded_channel::<Value>();
    let mut worker: Option<TerminalWorker> = None;

    loop {
        tokio::select! {
            _ = interval.tick() => {
                let _ = socket.send(Message::Text(json!({ "type": "ping" }).to_string().into())).await;
            }
            Some(event) = event_rx.recv() => {
                let _ = socket.send(Message::Text(event.to_string().into())).await;
            }
            msg = socket.recv() => {
                let Some(Ok(msg)) = msg else { break };
                if let Message::Text(text) = msg {
                    if let Ok(parsed) = serde_json::from_str::<WsMessage>(&text) {
                        if parsed.r#type == "pong" {
                            continue;
                        }
                        match parsed.r#type.as_str() {
                            "connect" => {
                                if let Some(data) = parsed.data {
                                    if let Some(w) = &worker {
                                        match w {
                                            TerminalWorker::Ssh(s) => { let _ = s.tx.send(SshReq::Disconnect); }
                                            TerminalWorker::Local(l) => { let _ = l.tx.send(LocalPtyReq::Disconnect); }
                                        }
                                    }
                                    if data.get("type").and_then(|v| v.as_str()) == Some("local") {
                                        match start_local_pty_worker(data, event_tx.clone()) {
                                            Ok(w) => worker = Some(TerminalWorker::Local(w)),
                                            Err(e) => {
                                                let _ = socket.send(Message::Text(json!({
                                                    "type": "error",
                                                    "data": e,
                                                }).to_string().into())).await;
                                            }
                                        }
                                    } else {
                                        match start_ssh_worker(
                                            data,
                                            event_tx.clone(),
                                            db.paths.known_hosts_path.clone(),
                                        ) {
                                            Ok(w) => worker = Some(TerminalWorker::Ssh(w)),
                                            Err(e) => {
                                                let _ = socket.send(Message::Text(json!({
                                                    "type": "error",
                                                    "data": e,
                                                }).to_string().into())).await;
                                            }
                                        }
                                    }
                                }
                            }
                            "input" => {
                                if let (Some(w), Some(data)) = (&worker, parsed.data) {
                                    if let Some(input) = data.as_str() {
                                        match w {
                                            TerminalWorker::Ssh(s) => { let _ = s.tx.send(SshReq::Input(input.to_string())); }
                                            TerminalWorker::Local(l) => { let _ = l.tx.send(LocalPtyReq::Input(input.to_string())); }
                                        }
                                    }
                                }
                            }
                            "resize" => {
                                if let (Some(w), Some(data)) = (&worker, parsed.data) {
                                    let cols = data.get("cols").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                                    let rows = data.get("rows").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                                    if cols > 0 && rows > 0 {
                                        match w {
                                            TerminalWorker::Ssh(s) => { let _ = s.tx.send(SshReq::Resize { cols, rows }); }
                                            TerminalWorker::Local(l) => { let _ = l.tx.send(LocalPtyReq::Resize { cols, rows }); }
                                        }
                                    }
                                }
                            }
                            "pwd" => {
                                let request_id = parsed
                                    .data
                                    .as_ref()
                                    .and_then(|v| v.get("requestId"))
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string());
                                if let Some(w) = &worker {
                                    match w {
                                        TerminalWorker::Ssh(s) => { let _ = s.tx.send(SshReq::Pwd { request_id }); }
                                        TerminalWorker::Local(_) => {
                                            let _ = socket.send(Message::Text(json!({
                                                "type": "pwd-result",
                                                "data": {
                                                    "requestId": request_id,
                                                    "path": null,
                                                    "error": "PWD is not supported for local terminals",
                                                }
                                            }).to_string().into())).await;
                                        }
                                    }
                                } else {
                                    let _ = socket.send(Message::Text(json!({
                                        "type": "pwd-result",
                                        "data": {
                                            "requestId": request_id,
                                            "path": null,
                                            "error": "Terminal is not connected",
                                        }
                                    }).to_string().into())).await;
                                }
                            }
                            "disconnect" => {
                                if let Some(w) = &worker {
                                    match w {
                                        TerminalWorker::Ssh(s) => { let _ = s.tx.send(SshReq::Disconnect); }
                                        TerminalWorker::Local(l) => { let _ = l.tx.send(LocalPtyReq::Disconnect); }
                                    }
                                }
                                break;
                            }
                            "monitor-start" => {
                                if let Some(TerminalWorker::Ssh(s)) = &worker {
                                    let _ = s.tx.send(SshReq::MonitorStart);
                                }
                            }
                            "monitor-stop" => {
                                if let Some(TerminalWorker::Ssh(s)) = &worker {
                                    let _ = s.tx.send(SshReq::MonitorStop);
                                }
                            }
                            "hostkey-verification-decision" => {
                                if let (Some(TerminalWorker::Ssh(s)), Some(data)) = (&worker, parsed.data) {
                                    let request_id = data.get("requestId").and_then(|v| v.as_str()).map(|v| v.to_string());
                                    let trust = data.get("trust").and_then(|v| v.as_bool()).unwrap_or(false);
                                    let replace_existing = data.get("replaceExisting").and_then(|v| v.as_bool()).unwrap_or(false);
                                    if let Some(request_id) = request_id {
                                        let _ = s.hostkey_tx.send(HostKeyDecision { request_id, trust, replace_existing });
                                    }
                                }
                            }
                            _ => {
                                let _ = socket.send(Message::Text(json!({
                                    "type": "error",
                                    "data": "Invalid request type",
                                }).to_string().into())).await;
                            }
                        }
                    }
                }
            }
        }
    }

    if let Some(w) = &worker {
        match w {
            TerminalWorker::Ssh(s) => {
                let _ = s.tx.send(SshReq::Disconnect);
            }
            TerminalWorker::Local(l) => {
                let _ = l.tx.send(LocalPtyReq::Disconnect);
            }
        }
    }
}

pub(super) async fn ws_sftp(mut socket: WebSocket, db: Db) {
    let mut interval = time::interval(std::time::Duration::from_secs(30));
    let (event_tx, mut event_rx) = tokio::sync::mpsc::unbounded_channel::<Value>();
    let mut sftp_worker: Option<SftpWorker> = None;
    let session_key = format!("ws-sftp-{}", Uuid::new_v4());

    loop {
        tokio::select! {
            _ = interval.tick() => {
                let _ = socket.send(Message::Text(json!({ "type": "ping" }).to_string().into())).await;
            }
            Some(event) = event_rx.recv() => {
                let _ = socket.send(Message::Text(event.to_string().into())).await;
            }
            msg = socket.recv() => {
                let Some(Ok(msg)) = msg else { break };
                if let Message::Text(text) = msg {
                    if let Ok(parsed) = serde_json::from_str::<WsMessage>(&text) {
                        if parsed.r#type == "pong" {
                            continue;
                        }
                        match parsed.r#type.as_str() {
                            "sftp-connect" => {
                                if let Some(data) = parsed.data {
                                    match start_sftp_worker(
                                        data,
                                        event_tx.clone(),
                                        db.paths.known_hosts_path.clone(),
                                        session_key.clone(),
                                        db.pool.clone(),
                                    ) {
                                        Ok(w) => sftp_worker = Some(w),
                                        Err(e) => {
                                            let mut resp = json!({
                                                "type": "sftp-error",
                                                "data": { "message": e }
                                            });
                                            if let Some(rid) = parsed.request_id {
                                                resp["requestId"] = Value::String(rid);
                                            }
                                            let _ = socket.send(Message::Text(resp.to_string().into())).await;
                                        }
                                    }
                                }
                            }
                            "hostkey-verification-decision" => {
                                if let (Some(w), Some(data)) = (&sftp_worker, parsed.data) {
                                    let request_id = data.get("requestId").and_then(|v| v.as_str()).map(|v| v.to_string());
                                    let trust = data.get("trust").and_then(|v| v.as_bool()).unwrap_or(false);
                                    let replace_existing = data.get("replaceExisting").and_then(|v| v.as_bool()).unwrap_or(false);
                                    if let Some(request_id) = request_id {
                                        let _ = w.hostkey_tx.send(HostKeyDecision { request_id, trust, replace_existing });
                                    }
                                }
                            }
                            "sftp-disconnect" => {
                                if let Some(w) = &sftp_worker {
                                    let _ = w.tx.send(WorkerReq::Disconnect);
                                }
                                break;
                            }
                            _ => {
                                if let Some(w) = &sftp_worker {
                                    if let Some(req) = build_worker_req(&parsed) {
                                        let _ = w.tx.send(req);
                                    } else {
                                        let mut resp = json!({
                                            "type": "sftp-error",
                                            "data": { "message": "Invalid SFTP request payload" }
                                        });
                                        if let Some(rid) = parsed.request_id.clone() {
                                            resp["requestId"] = Value::String(rid);
                                        }
                                        let _ = socket.send(Message::Text(resp.to_string().into())).await;
                                    }
                                } else {
                                    let mut resp = json!({
                                        "type": "sftp-error",
                                        "data": { "message": "SFTP is not connected" }
                                    });
                                    if let Some(rid) = parsed.request_id.clone() {
                                        resp["requestId"] = Value::String(rid);
                                    }
                                    let _ = socket.send(Message::Text(resp.to_string().into())).await;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
