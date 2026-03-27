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
use crate::server::ws::local_pty_worker::{LocalPtyReq, LocalPtyWorker, start_local_pty_worker};
use crate::server::ws::ssh_worker::{HostKeyDecision, SshReq, SshWorker, start_ssh_worker};

#[derive(Debug, Clone, Deserialize)]
pub struct BridgeClientMessage {
    pub r#type: String,
    pub data: Option<Value>,
    #[allow(dead_code)]
    #[serde(rename = "requestId")]
    pub request_id: Option<String>,
}

enum TerminalWorker {
    Ssh(SshWorker),
    Local(LocalPtyWorker),
}

struct BridgeSession {
    tx: UnboundedSender<BridgeClientMessage>,
    task: JoinHandle<()>,
}

#[derive(Clone, Default)]
pub struct TerminalBridgeHub {
    inner: Arc<Mutex<HashMap<String, BridgeSession>>>,
}

impl TerminalBridgeHub {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn open(&self, app: AppHandle, db: Db, session_id: String) -> Result<(), String> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| "terminal bridge session lock failed".to_string())?;
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
            .map_err(|_| "terminal bridge session lock failed".to_string())?;
        let Some(session) = guard.get(session_id) else {
            return Err("terminal bridge session not found".to_string());
        };
        session
            .tx
            .send(msg)
            .map_err(|_| "terminal bridge session channel closed".to_string())
    }

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| "terminal bridge session lock failed".to_string())?;
        if let Some(session) = guard.remove(session_id) {
            session.task.abort();
        }
        Ok(())
    }
}

fn emit_terminal_event(app: &AppHandle, session_id: &str, payload: Value) {
    let event_name = format!("terminal-bridge://{session_id}");
    let _ = app.emit(&event_name, payload);
}

async fn run_bridge_session(
    app: AppHandle,
    db: Db,
    session_id: String,
    mut rx: UnboundedReceiver<BridgeClientMessage>,
) {
    let mut worker: Option<TerminalWorker> = None;
    let (event_tx, mut event_rx) = unbounded_channel::<Value>();
    let mut ping_interval = time::interval(Duration::from_secs(30));

    loop {
        tokio::select! {
            _ = ping_interval.tick() => {
                emit_terminal_event(&app, &session_id, json!({ "type": "ping" }));
            }
            Some(event) = event_rx.recv() => {
                emit_terminal_event(&app, &session_id, event);
            }
            incoming = rx.recv() => {
                let Some(parsed) = incoming else { break };
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
                                    Err(error) => emit_terminal_event(&app, &session_id, json!({ "type": "error", "data": error })),
                                }
                            } else {
                                match start_ssh_worker(data, event_tx.clone(), db.paths.known_hosts_path.clone()) {
                                    Ok(w) => worker = Some(TerminalWorker::Ssh(w)),
                                    Err(error) => emit_terminal_event(&app, &session_id, json!({ "type": "error", "data": error })),
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
                                    emit_terminal_event(&app, &session_id, json!({
                                        "type": "pwd-result",
                                        "data": {
                                            "requestId": request_id,
                                            "path": null,
                                            "error": "PWD is not supported for local terminals",
                                        }
                                    }));
                                }
                            }
                        } else {
                            emit_terminal_event(&app, &session_id, json!({
                                "type": "pwd-result",
                                "data": {
                                    "requestId": request_id,
                                    "path": null,
                                    "error": "Terminal is not connected",
                                }
                            }));
                        }
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
                                let _ = s.hostkey_tx.send(HostKeyDecision {
                                    request_id,
                                    trust,
                                    replace_existing,
                                });
                            }
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
                    "pong" => {
                        // heartbeat ack, no-op
                    }
                    _ => {
                        emit_terminal_event(&app, &session_id, json!({
                            "type": "error",
                            "data": format!("Invalid request type: {}", parsed.r#type),
                        }));
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
