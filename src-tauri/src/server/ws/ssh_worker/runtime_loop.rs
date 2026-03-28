use russh::{ChannelMsg, client};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::mpsc as tokio_mpsc;

use crate::server::helpers::KnownHostsHandler;

use super::SshReq;
use super::monitor::{collect_monitor_snapshot, handle_monitor_init};
use super::shell_integration::{ShellIntegrationState, process_shell_integration_output};

pub(super) async fn ssh_main_loop(
    handle: &client::Handle<KnownHostsHandler>,
    channel: &mut russh::Channel<client::Msg>,
    mut rx: tokio_mpsc::UnboundedReceiver<SshReq>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
) {
    let mut pwd_request_id: Option<String> = None;
    let mut pwd_buffer = String::new();
    let mut suppress_until: Option<Instant> = None;
    let mut shell_integration = ShellIntegrationState {
        buffer: String::new(),
        current_cwd: None,
        pending_command: None,
        ready_emitted: false,
    };

    let mut monitor_enabled = false;
    let mut monitor_interval = tokio::time::interval(Duration::from_secs(3));
    let mut prev_cpu_sample: Option<Vec<u64>> = None;
    let mut prev_per_core_samples: Option<Vec<Vec<u64>>> = None;
    let mut prev_net_sample: Option<HashMap<String, (u64, u64)>> = None;
    let mut prev_sample_time: Option<Instant> = None;
    let mut cpu_core_count: u32 = 1;

    loop {
        tokio::select! {
            Some(req) = rx.recv() => {
                match req {
                    SshReq::Input(data) => { let _ = channel.data(data.as_bytes()).await; }
                    SshReq::Resize { cols, rows } => { let _ = channel.window_change(cols, rows, 0, 0).await; }
                    SshReq::Pwd { request_id } => {
                        pwd_request_id = request_id;
                        pwd_buffer.clear();
                        let _ = channel.data(&b" printf '\\x5f\\x5fVORTIX_PWD_START\\x5f\\x5f%s\\x5f\\x5fVORTIX_PWD_END\\x5f\\x5f\\n' \"$(pwd)\"\n"[..]).await;
                    }
                    SshReq::MonitorStart => {
                        monitor_enabled = true;
                        prev_cpu_sample = None;
                        prev_per_core_samples = None;
                        prev_net_sample = None;
                        prev_sample_time = None;
                        monitor_interval.reset();
                        handle_monitor_init(handle, event_tx, &mut cpu_core_count).await;
                    }
                    SshReq::MonitorStop => {
                        monitor_enabled = false;
                        prev_cpu_sample = None;
                        prev_per_core_samples = None;
                        prev_net_sample = None;
                        prev_sample_time = None;
                    }
                    SshReq::Disconnect => { let _ = channel.close().await; break; }
                }
            }
            Some(msg) = channel.wait() => {
                match msg {
                    ChannelMsg::Data { data } => {
                        let text = String::from_utf8_lossy(&data).to_string();
                        if let Some(req_id) = pwd_request_id.clone() {
                            pwd_buffer.push_str(&text);
                            let start = pwd_buffer.find("__VORTIX_PWD_START__");
                            let end = pwd_buffer.find("__VORTIX_PWD_END__");
                            if let (Some(s), Some(e)) = (start, end) {
                                if e > s {
                                    let path = pwd_buffer[s + "__VORTIX_PWD_START__".len()..e].trim().to_string();
                                    let _ = event_tx.send(json!({
                                        "type": "pwd-result",
                                        "data": { "requestId": req_id, "path": path }
                                    }));
                                    pwd_request_id = None;
                                    pwd_buffer.clear();
                                    suppress_until = Some(Instant::now() + Duration::from_millis(300));
                                    continue;
                                }
                            }
                            continue;
                        }
                        if let Some(until) = suppress_until {
                            if Instant::now() < until { continue; }
                            suppress_until = None;
                        }
                        if let Some(output) = process_shell_integration_output(&mut shell_integration, &text, event_tx) {
                            if !output.is_empty() {
                                let _ = event_tx.send(json!({ "type": "output", "data": output }));
                            }
                        }
                    }
                    ChannelMsg::Eof | ChannelMsg::Close => break,
                    _ => {}
                }
            }
            _ = monitor_interval.tick(), if monitor_enabled => {
                collect_monitor_snapshot(
                    handle, event_tx,
                    &mut prev_cpu_sample, &mut prev_per_core_samples,
                    &mut prev_net_sample, &mut prev_sample_time,
                    cpu_core_count,
                ).await;
            }
            else => break,
        }
    }
}
