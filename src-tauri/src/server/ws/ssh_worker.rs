/* SSH terminal worker (russh) */

#[path = "ssh_worker/connection_flow.rs"]
mod connection_flow;
#[path = "ssh_worker/monitor.rs"]
mod monitor;
#[path = "ssh_worker/runtime_loop.rs"]
mod runtime_loop;
#[path = "ssh_worker/shell_integration.rs"]
mod shell_integration;
#[path = "ssh_worker/task.rs"]
mod task;

use crate::server::helpers::{KnownHostsHandler, RusshJumpHostConfig};
use russh::{ChannelMsg, client};
use serde_json::{Value, json};
use std::path::PathBuf;
use tokio::sync::mpsc as tokio_mpsc;

use connection_flow::parse_jump_config;
use task::ssh_worker_task;

#[derive(Clone)]
pub struct SshWorker {
    pub tx: tokio_mpsc::UnboundedSender<SshReq>,
    pub hostkey_tx: tokio_mpsc::UnboundedSender<HostKeyDecision>,
}

#[derive(Debug)]
pub enum SshReq {
    Input(String),
    Resize { cols: u32, rows: u32 },
    Pwd { request_id: Option<String> },
    MonitorStart,
    MonitorStop,
    Disconnect,
}

#[derive(Debug, Clone)]
pub struct HostKeyDecision {
    pub request_id: String,
    pub trust: bool,
    pub replace_existing: bool,
}

pub(super) async fn russh_exec(
    handle: &client::Handle<KnownHostsHandler>,
    cmd: &str,
) -> Result<String, String> {
    let mut ch = handle
        .channel_open_session()
        .await
        .map_err(|e| e.to_string())?;
    ch.exec(true, cmd).await.map_err(|e| e.to_string())?;
    let mut stdout = String::new();
    while let Some(msg) = ch.wait().await {
        match msg {
            ChannelMsg::Data { data } => stdout.push_str(&String::from_utf8_lossy(&data)),
            ChannelMsg::Eof | ChannelMsg::Close => break,
            _ => {}
        }
    }
    Ok(stdout)
}

pub fn start_ssh_worker(
    connect: Value,
    event_tx: tokio::sync::mpsc::UnboundedSender<Value>,
    known_hosts_path: PathBuf,
) -> Result<SshWorker, String> {
    let host = connect
        .get("host")
        .and_then(|v| v.as_str())
        .ok_or("Missing host")?
        .to_string();
    let username = connect
        .get("username")
        .and_then(|v| v.as_str())
        .ok_or("Missing username")?
        .to_string();
    let port = connect.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let password = connect
        .get("password")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let private_key = connect
        .get("privateKey")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let passphrase = connect
        .get("passphrase")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let connection_id = connect
        .get("connectionId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let connection_name = connect
        .get("connectionName")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let terminal_enhance = connect
        .get("terminalEnhance")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let jump: Option<RusshJumpHostConfig> = parse_jump_config(&connect)?;
    let cols = connect
        .get("cols")
        .and_then(|v| v.as_u64())
        .unwrap_or(120)
        .clamp(1, 500) as u32;
    let rows = connect
        .get("rows")
        .and_then(|v| v.as_u64())
        .unwrap_or(30)
        .clamp(1, 200) as u32;

    let (tx, rx) = tokio_mpsc::unbounded_channel::<SshReq>();
    let (hostkey_tx, hostkey_rx) = tokio_mpsc::unbounded_channel::<HostKeyDecision>();

    tokio::spawn(async move {
        if let Err(e) = ssh_worker_task(
            host,
            port,
            username,
            password,
            private_key,
            passphrase,
            connection_id,
            connection_name,
            terminal_enhance,
            jump,
            known_hosts_path,
            cols,
            rows,
            rx,
            hostkey_rx,
            event_tx.clone(),
        )
        .await
        {
            let _ = event_tx.send(json!({ "type": "error", "data": e }));
        }
    });

    Ok(SshWorker { tx, hostkey_tx })
}
