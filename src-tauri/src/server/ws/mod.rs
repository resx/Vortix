/* ── WebSocket 模块（SSH 终端 / 本地终端 / SFTP） ── */

pub mod ssh_worker;
pub mod local_pty_worker;
pub mod sftp_worker;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::response::IntoResponse;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::time;

use ssh_worker::{SshWorker, SshReq, start_ssh_worker};
use local_pty_worker::{LocalPtyWorker, LocalPtyReq, start_local_pty_worker};
use sftp_worker::{SftpWorker, WorkerReq, build_worker_req, start_sftp_worker};

/* ── 共享类型 ── */

#[derive(Deserialize)]
pub struct WsMessage {
    pub r#type: String,
    pub data: Option<Value>,
    #[serde(rename = "requestId")]
    pub request_id: Option<String>,
}

enum TerminalWorker {
    Ssh(SshWorker),
    Local(LocalPtyWorker),
}

/* ── 升级处理器 ── */

pub async fn ws_upgrade_ssh(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(ws_ssh)
}

pub async fn ws_upgrade_sftp(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(ws_sftp)
}

/* ── SSH / 本地终端 WebSocket ── */

async fn ws_ssh(mut socket: WebSocket) {
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
                                                    "type": "error", "data": e
                                                }).to_string().into())).await;
                                            }
                                        }
                                    } else {
                                        match start_ssh_worker(data, event_tx.clone()) {
                                            Ok(w) => worker = Some(TerminalWorker::Ssh(w)),
                                            Err(e) => {
                                                let _ = socket.send(Message::Text(json!({
                                                    "type": "error", "data": e
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
                                let request_id = parsed.data
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
                                                "data": { "requestId": request_id, "path": null, "error": "本地终端不支持" }
                                            }).to_string().into())).await;
                                        }
                                    }
                                } else {
                                    let _ = socket.send(Message::Text(json!({
                                        "type": "pwd-result",
                                        "data": { "requestId": request_id, "path": null, "error": "未连接" }
                                    }).to_string().into())).await;
                                }
                            }
                            "highlight-config" => {
                                let _ = socket.send(Message::Text(json!({
                                    "type": "highlight-config-ack",
                                    "data": { "categories": [] }
                                }).to_string().into())).await;
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
                            _ => {
                                let _ = socket.send(Message::Text(json!({
                                    "type": "error", "data": "请求类型无效"
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
            TerminalWorker::Ssh(s) => { let _ = s.tx.send(SshReq::Disconnect); }
            TerminalWorker::Local(l) => { let _ = l.tx.send(LocalPtyReq::Disconnect); }
        }
    }
}

/* ── SFTP WebSocket ── */

async fn ws_sftp(mut socket: WebSocket) {
    let mut interval = time::interval(std::time::Duration::from_secs(30));
    let (event_tx, mut event_rx) = tokio::sync::mpsc::unbounded_channel::<Value>();
    let mut sftp_worker: Option<SftpWorker> = None;
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
                                    match start_sftp_worker(data, event_tx.clone()) {
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
                                            "data": { "message": "请求数据无效" }
                                        });
                                        if let Some(rid) = parsed.request_id.clone() {
                                            resp["requestId"] = Value::String(rid);
                                        }
                                        let _ = socket.send(Message::Text(resp.to_string().into())).await;
                                    }
                                } else {
                                    let mut resp = json!({
                                        "type": "sftp-error",
                                        "data": { "message": "SFTP 未连接" }
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
