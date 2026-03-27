use serde::Deserialize;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};
use tokio::time;

use crate::db::Db;
use crate::server::ws::WsMessage;
use crate::server::ws::sftp_worker::{SftpWorker, WorkerReq, build_worker_req, start_sftp_worker};
use crate::server::ws::ssh_worker::HostKeyDecision;

#[derive(Debug, Clone, Deserialize)]
pub struct BridgeClientMessage {
    pub r#type: String,
    pub data: Option<Value>,
    #[allow(dead_code)]
    #[serde(rename = "requestId")]
    pub request_id: Option<String>,
}

struct BridgeSession {
    tx: UnboundedSender<BridgeClientMessage>,
    task: JoinHandle<()>,
}

#[derive(Clone, Default)]
pub struct SftpBridgeHub {
    inner: Arc<Mutex<HashMap<String, BridgeSession>>>,
}

impl SftpBridgeHub {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open(&self, app: AppHandle, db: Db, session_id: String) -> Result<(), String> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| "sftp bridge session lock failed".to_string())?;
        if guard.contains_key(&session_id) {
            return Ok(());
        }
        let (tx, rx) = unbounded_channel::<BridgeClientMessage>();
        let task = tauri::async_runtime::spawn(run_bridge_session(app, db, session_id.clone(), rx));
        guard.insert(session_id, BridgeSession { tx, task });
        Ok(())
    }

    pub fn send(&self, session_id: &str, msg: BridgeClientMessage) -> Result<(), String> {
        let guard = self
            .inner
            .lock()
            .map_err(|_| "sftp bridge session lock failed".to_string())?;
        let Some(session) = guard.get(session_id) else {
            return Err("sftp bridge session not found".to_string());
        };
        session
            .tx
            .send(msg)
            .map_err(|_| "sftp bridge session channel closed".to_string())
    }

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| "sftp bridge session lock failed".to_string())?;
        if let Some(session) = guard.remove(session_id) {
            session.task.abort();
        }
        Ok(())
    }
}

fn emit_sftp_event(app: &AppHandle, session_id: &str, payload: Value) {
    let event_name = format!("sftp-bridge://{session_id}");
    let _ = app.emit(&event_name, payload);
}

async fn run_bridge_session(
    app: AppHandle,
    db: Db,
    session_id: String,
    mut rx: UnboundedReceiver<BridgeClientMessage>,
) {
    let mut worker: Option<SftpWorker> = None;
    let (event_tx, mut event_rx) = unbounded_channel::<Value>();
    let mut ping_interval = time::interval(Duration::from_secs(30));

    loop {
        tokio::select! {
            _ = ping_interval.tick() => {
                emit_sftp_event(&app, &session_id, json!({ "type": "ping" }));
            }
            Some(event) = event_rx.recv() => {
                emit_sftp_event(&app, &session_id, event);
            }
            incoming = rx.recv() => {
                let Some(parsed) = incoming else { break };
                match parsed.r#type.as_str() {
                    "sftp-connect" => {
                        if let Some(data) = parsed.data {
                            match start_sftp_worker(data, event_tx.clone(), db.paths.known_hosts_path.clone()) {
                                Ok(w) => worker = Some(w),
                                Err(error) => {
                                    emit_sftp_event(&app, &session_id, json!({
                                        "type": "sftp-error",
                                        "data": { "message": error }
                                    }));
                                }
                            }
                        }
                    }
                    "hostkey-verification-decision" => {
                        if let (Some(w), Some(data)) = (&worker, parsed.data) {
                            let request_id = data
                                .get("requestId")
                                .and_then(|v| v.as_str())
                                .map(|v| v.to_string());
                            let trust = data.get("trust").and_then(|v| v.as_bool()).unwrap_or(false);
                            let replace_existing = data
                                .get("replaceExisting")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false);

                            if let Some(request_id) = request_id {
                                let _ = w.hostkey_tx.send(HostKeyDecision {
                                    request_id,
                                    trust,
                                    replace_existing,
                                });
                            }
                        }
                    }
                    "sftp-disconnect" => {
                        if let Some(w) = &worker {
                            let _ = w.tx.send(WorkerReq::Disconnect);
                        }
                        break;
                    }
                    "pong" => {
                        // heartbeat ack, no-op
                    }
                    _ => {
                        if let Some(w) = &worker {
                            let ws_msg = WsMessage {
                                r#type: parsed.r#type,
                                data: parsed.data,
                                request_id: parsed.request_id,
                            };
                            if let Some(req) = build_worker_req(&ws_msg) {
                                let _ = w.tx.send(req);
                            } else {
                                let mut payload = json!({
                                    "type": "sftp-error",
                                    "data": { "message": "Invalid SFTP request payload" }
                                });
                                if let Some(rid) = ws_msg.request_id {
                                    payload["requestId"] = Value::String(rid);
                                }
                                emit_sftp_event(&app, &session_id, payload);
                            }
                        } else {
                            let mut payload = json!({
                                "type": "sftp-error",
                                "data": { "message": "SFTP is not connected" }
                            });
                            if let Some(rid) = parsed.request_id {
                                payload["requestId"] = Value::String(rid);
                            }
                            emit_sftp_event(&app, &session_id, payload);
                        }
                    }
                }
            }
        }
    }

    if let Some(w) = &worker {
        let _ = w.tx.send(WorkerReq::Disconnect);
    }
}
