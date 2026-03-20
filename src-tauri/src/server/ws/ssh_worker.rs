/* ── SSH 终端 Worker (russh) ── */

use russh::keys::{decode_secret_key, PrivateKeyWithHashAlg};
use russh::{client, ChannelMsg};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc as tokio_mpsc;

/* ── 类型 ── */

#[derive(Clone)]
pub struct SshWorker {
    pub tx: tokio_mpsc::UnboundedSender<SshReq>,
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

/* ── russh Handler ── */

struct SshHandler;

impl client::Handler for SshHandler {
    type Error = russh::Error;

    async fn check_server_key(&mut self, _key: &russh::keys::ssh_key::PublicKey) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

/* ── 辅助函数 ── */

fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

async fn russh_exec(handle: &client::Handle<SshHandler>, cmd: &str) -> Result<String, String> {
    let mut ch = handle.channel_open_session().await.map_err(|e| e.to_string())?;
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

/* ── Worker 启动 ── */

pub fn start_ssh_worker(
    connect: Value,
    event_tx: tokio::sync::mpsc::UnboundedSender<Value>,
) -> Result<SshWorker, String> {
    let host = connect.get("host").and_then(|v| v.as_str()).ok_or("缺少主机地址")?.to_string();
    let username = connect.get("username").and_then(|v| v.as_str()).ok_or("缺少用户名")?.to_string();
    let port = connect.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let password = connect.get("password").and_then(|v| v.as_str()).map(|s| s.to_string());
    let private_key = connect.get("privateKey").and_then(|v| v.as_str()).map(|s| s.to_string());
    let passphrase = connect.get("passphrase").and_then(|v| v.as_str()).map(|s| s.to_string());
    let cols = connect.get("cols").and_then(|v| v.as_u64()).unwrap_or(120).clamp(1, 500) as u32;
    let rows = connect.get("rows").and_then(|v| v.as_u64()).unwrap_or(30).clamp(1, 200) as u32;

    let (tx, rx) = tokio_mpsc::unbounded_channel::<SshReq>();

    tokio::spawn(async move {
        if let Err(e) = ssh_worker_task(
            host, port, username, password, private_key, passphrase,
            cols, rows, rx, event_tx.clone(),
        ).await {
            let _ = event_tx.send(json!({ "type": "error", "data": e }));
        }
    });

    Ok(SshWorker { tx })
}

async fn ssh_worker_task(
    host: String, port: u16, username: String,
    password: Option<String>, private_key: Option<String>, passphrase: Option<String>,
    cols: u32, rows: u32,
    rx: tokio_mpsc::UnboundedReceiver<SshReq>,
    event_tx: tokio::sync::mpsc::UnboundedSender<Value>,
) -> Result<(), String> {
    let config = Arc::new(client::Config::default());
    let mut handle = client::connect(config, (host.as_str(), port), SshHandler)
        .await
        .map_err(|e| format!("SSH 连接失败: {}", e))?;

    tracing::info!("SSH 会话已建立 ({})，开始认证用户: {}", host, username);

    let auth_result = if let Some(key_str) = private_key.as_deref() {
        tracing::info!("尝试私钥认证 (用户: {}, 长度: {}, 有口令: {})", username, key_str.len(), passphrase.is_some());
        let key_pair = decode_secret_key(key_str, passphrase.as_deref())
            .map_err(|e| format!("私钥解析失败: {}", e))?;
        handle.authenticate_publickey(
            &username,
            PrivateKeyWithHashAlg::new(
                Arc::new(key_pair),
                handle.best_supported_rsa_hash().await.map_err(|e| e.to_string())?.flatten(),
            ),
        ).await.map_err(|e| format!("认证失败: {}", e))?
    } else if let Some(pwd) = password.as_deref() {
        tracing::info!("尝试密码认证 (用户: {})", username);
        handle.authenticate_password(&username, pwd)
            .await.map_err(|e| format!("认证失败: {}", e))?
    } else {
        return Err("缺少认证方式".to_string());
    };

    if !auth_result.success() {
        return Err("认证失败: 凭据无效或服务器拒绝访问".to_string());
    }
    tracing::info!("SSH 认证成功 ({})", host);

    let mut channel = handle.channel_open_session().await
        .map_err(|e| format!("创建通道失败: {}", e))?;
    channel.request_pty(false, "xterm-256color", cols, rows, 0, 0, &[]).await
        .map_err(|e| format!("申请 PTY 失败: {}", e))?;
    channel.request_shell(false).await
        .map_err(|e| format!("启动 Shell 失败: {}", e))?;

    let _ = event_tx.send(json!({ "type": "status", "data": "connected" }));
    ssh_main_loop(&handle, &mut channel, rx, &event_tx).await;
    let _ = event_tx.send(json!({ "type": "status", "data": "closed" }));
    Ok(())
}

/* ── SSH 主循环 ── */

async fn ssh_main_loop(
    handle: &client::Handle<SshHandler>,
    channel: &mut russh::Channel<client::Msg>,
    mut rx: tokio_mpsc::UnboundedReceiver<SshReq>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
) {
    let mut pwd_request_id: Option<String> = None;
    let mut pwd_buffer = String::new();
    let mut suppress_until: Option<Instant> = None;

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
                        let _ = event_tx.send(json!({ "type": "output", "data": text }));
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

/* ── 监控初始化 ── */

async fn handle_monitor_init(
    handle: &client::Handle<SshHandler>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    cpu_core_count: &mut u32,
) {
    if let Ok(raw) = russh_exec(handle, "uname -sr; echo \"===SEP===\"; hostname; echo \"===SEP===\"; whoami; echo \"===SEP===\"; cat /proc/uptime; echo \"===SEP===\"; nproc").await {
        let parts: Vec<&str> = raw.split("===SEP===").map(|s| s.trim()).collect();
        let os = parts.first().copied().unwrap_or("Linux");
        let host = parts.get(1).copied().unwrap_or("unknown");
        let user = parts.get(2).copied().unwrap_or("unknown");
        let uptime_sec = parts.get(3).and_then(|s| s.split_whitespace().next()).and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
        if let Some(count) = parts.get(4).and_then(|s| s.parse::<u32>().ok()) {
            *cpu_core_count = count.max(1);
        }
        let days = (uptime_sec / 86400.0).floor() as i64;
        let hours = ((uptime_sec % 86400.0) / 3600.0).floor() as i64;
        let mins = ((uptime_sec % 3600.0) / 60.0).floor() as i64;
        let uptime = format!("{days}d {hours}h {mins}m");
        let _ = event_tx.send(json!({
            "type": "monitor-info",
            "data": { "user": user, "host": host, "uptime": uptime, "os": os }
        }));
    }
}

/* ── 监控快照采集 ── */

#[allow(clippy::too_many_arguments)]
async fn collect_monitor_snapshot(
    handle: &client::Handle<SshHandler>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    prev_cpu_sample: &mut Option<Vec<u64>>,
    prev_per_core_samples: &mut Option<Vec<Vec<u64>>>,
    prev_net_sample: &mut Option<HashMap<String, (u64, u64)>>,
    prev_sample_time: &mut Option<Instant>,
    cpu_core_count: u32,
) {
    let cmd = "cat /proc/stat; echo \"===SEP===\"; cat /proc/meminfo | grep -E \"^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):\"; echo \"===SEP===\"; df -B1 2>/dev/null | tail -n +2; echo \"===SEP===\"; cat /proc/net/dev | tail -n +3; echo \"===SEP===\"; ps aux --sort=-%cpu 2>/dev/null | head -11";
    let Ok(raw) = russh_exec(handle, cmd).await else { return };

    let sections: Vec<&str> = raw.split("===SEP===").map(|s| s.trim()).collect();
    let stat_lines: Vec<&str> = sections.first().copied().unwrap_or("").lines().collect();
    let mem_lines: Vec<&str> = sections.get(1).copied().unwrap_or("").lines().collect();
    let df_lines: Vec<&str> = sections.get(2).copied().unwrap_or("").lines().collect();
    let net_lines: Vec<&str> = sections.get(3).copied().unwrap_or("").lines().collect();
    let ps_lines: Vec<&str> = sections.get(4).copied().unwrap_or("").lines().collect();

    let (cpu_usage, cpu_kernel, cpu_user, cpu_io) = parse_cpu_total(&stat_lines, prev_cpu_sample);
    let cpu_per_core = parse_cpu_per_core(&stat_lines, prev_per_core_samples);
    let (mem_used, mem_total, swap_used, swap_total) = parse_memory(&mem_lines);
    let disks = parse_disks(&df_lines);
    let now = Instant::now();
    let elapsed = prev_sample_time.map(|t| now.duration_since(t).as_secs_f64()).unwrap_or(3.0);
    *prev_sample_time = Some(now);
    let (net_up, net_down, net_total_up, net_total_down, nics) = parse_network(&net_lines, prev_net_sample, elapsed);
    let processes = parse_processes(&ps_lines);

    let snapshot = json!({
        "cpuCores": cpu_core_count,
        "cpuUsage": cpu_usage, "cpuKernel": cpu_kernel,
        "cpuUser": cpu_user, "cpuIo": cpu_io,
        "cpuPerCore": cpu_per_core,
        "memUsed": mem_used, "memTotal": mem_total,
        "swapUsed": swap_used, "swapTotal": swap_total,
        "netUp": round1(net_up), "netDown": round1(net_down),
        "netTotalUp": net_total_up, "netTotalDown": net_total_down,
        "processes": processes, "nics": nics, "disks": disks,
    });
    let _ = event_tx.send(json!({ "type": "monitor-data", "data": snapshot }));
}

/* ── 解析函数 ── */

fn parse_cpu_total(stat_lines: &[&str], prev_cpu_sample: &mut Option<Vec<u64>>) -> (f64, f64, f64, f64) {
    let mut cpu_usage = 0.0;
    let mut cpu_kernel = 0.0;
    let mut cpu_user = 0.0;
    let mut cpu_io = 0.0;
    if let Some(line) = stat_lines.first() {
        let fields: Vec<u64> = line.replace("cpu", "").split_whitespace().filter_map(|v| v.parse::<u64>().ok()).collect();
        if fields.len() >= 5 {
            let total: u64 = fields.iter().sum();
            if let Some(prev) = prev_cpu_sample {
                let prev_total: u64 = prev.iter().sum();
                let d_total = total.saturating_sub(prev_total) as f64;
                let idle = *fields.get(3).unwrap_or(&0) + *fields.get(4).unwrap_or(&0);
                let prev_idle = *prev.get(3).unwrap_or(&0) + *prev.get(4).unwrap_or(&0);
                let d_idle = idle.saturating_sub(prev_idle) as f64;
                if d_total > 0.0 {
                    cpu_usage = round1((1.0 - d_idle / d_total) * 100.0);
                    let curr_system = *fields.get(2).unwrap_or(&0);
                    let prev_system = *prev.get(2).unwrap_or(&0);
                    cpu_kernel = round1(((curr_system.saturating_sub(prev_system)) as f64 / d_total) * 100.0);
                    let curr_user = *fields.get(0).unwrap_or(&0) + *fields.get(1).unwrap_or(&0);
                    let prev_user = *prev.get(0).unwrap_or(&0) + *prev.get(1).unwrap_or(&0);
                    cpu_user = round1(((curr_user.saturating_sub(prev_user)) as f64 / d_total) * 100.0);
                    let curr_io = *fields.get(4).unwrap_or(&0);
                    let prev_io = *prev.get(4).unwrap_or(&0);
                    cpu_io = round1(((curr_io.saturating_sub(prev_io)) as f64 / d_total) * 100.0);
                }
            }
            *prev_cpu_sample = Some(fields);
        }
    }
    (cpu_usage, cpu_kernel, cpu_user, cpu_io)
}

fn parse_cpu_per_core(stat_lines: &[&str], prev_per_core_samples: &mut Option<Vec<Vec<u64>>>) -> Vec<f64> {
    let mut cpu_per_core: Vec<f64> = Vec::new();
    let mut per_core_samples: Vec<Vec<u64>> = Vec::new();
    for line in stat_lines.iter().skip(1) {
        if !line.starts_with("cpu") { break; }
        let fields: Vec<u64> = line.replace("cpu", "").split_whitespace().filter_map(|v| v.parse::<u64>().ok()).collect();
        if fields.len() < 5 { continue; }
        if let Some(prev_list) = prev_per_core_samples.as_ref() {
            if let Some(prev) = prev_list.get(per_core_samples.len()) {
                let total: u64 = fields.iter().sum();
                let prev_total: u64 = prev.iter().sum();
                let d_total = total.saturating_sub(prev_total) as f64;
                let idle = *fields.get(3).unwrap_or(&0) + *fields.get(4).unwrap_or(&0);
                let prev_idle = *prev.get(3).unwrap_or(&0) + *prev.get(4).unwrap_or(&0);
                let d_idle = idle.saturating_sub(prev_idle) as f64;
                let val = if d_total > 0.0 { ((1.0 - d_idle / d_total) * 100.0).round() } else { 0.0 };
                cpu_per_core.push(val);
            } else { cpu_per_core.push(0.0); }
        } else { cpu_per_core.push(0.0); }
        per_core_samples.push(fields);
    }
    *prev_per_core_samples = Some(per_core_samples);
    cpu_per_core
}

fn parse_memory(mem_lines: &[&str]) -> (f64, f64, f64, f64) {
    let mut mem_map: HashMap<String, u64> = HashMap::new();
    for line in mem_lines {
        let mut parts = line.split_whitespace();
        if let (Some(key), Some(val)) = (parts.next(), parts.next()) {
            let k = key.trim_end_matches(':').to_string();
            if let Ok(v) = val.parse::<u64>() { mem_map.insert(k, v); }
        }
    }
    let mem_total_kb = *mem_map.get("MemTotal").unwrap_or(&0) as f64;
    let mem_available_kb = if let Some(v) = mem_map.get("MemAvailable") {
        *v as f64
    } else {
        (*mem_map.get("MemFree").unwrap_or(&0) + *mem_map.get("Buffers").unwrap_or(&0) + *mem_map.get("Cached").unwrap_or(&0)) as f64
    };
    let mem_used = round1(((mem_total_kb - mem_available_kb) / 1024.0).max(0.0));
    let mem_total = round1(mem_total_kb / 1024.0);
    let swap_total = round1((*mem_map.get("SwapTotal").unwrap_or(&0) as f64) / 1024.0);
    let swap_used = round1(((*mem_map.get("SwapTotal").unwrap_or(&0) - *mem_map.get("SwapFree").unwrap_or(&0)) as f64 / 1024.0).max(0.0));
    (mem_used, mem_total, swap_used, swap_total)
}

fn parse_disks(df_lines: &[&str]) -> Vec<Value> {
    let mut disks = Vec::new();
    for line in df_lines {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 6 { continue; }
        let total_b = cols.get(1).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        let used_b = cols.get(2).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        if total_b == 0 { continue; }
        let total = round1(total_b as f64 / (1024.0 * 1024.0 * 1024.0));
        let used = round1(used_b as f64 / (1024.0 * 1024.0 * 1024.0));
        let percent = ((used_b as f64 / total_b as f64) * 100.0).floor();
        disks.push(json!({ "name": cols[0], "used": used, "total": total, "percent": percent, "path": cols[5] }));
    }
    disks
}

fn parse_network(
    net_lines: &[&str],
    prev_net_sample: &mut Option<HashMap<String, (u64, u64)>>,
    elapsed: f64,
) -> (f64, f64, u64, u64, Vec<Value>) {
    let mut net_up = 0.0;
    let mut net_down = 0.0;
    let mut net_total_up: u64 = 0;
    let mut net_total_down: u64 = 0;
    let mut nics = Vec::new();
    let mut current_net_sample: HashMap<String, (u64, u64)> = HashMap::new();
    for line in net_lines {
        if let Some((name_part, data_part)) = line.split_once(':') {
            let name = name_part.trim().to_string();
            let cols: Vec<&str> = data_part.split_whitespace().collect();
            if cols.len() < 9 { continue; }
            let rx = cols.first().and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
            let tx = cols.get(8).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
            current_net_sample.insert(name.clone(), (rx, tx));
            net_total_up += tx;
            net_total_down += rx;
            let mut rx_rate = 0.0;
            let mut tx_rate = 0.0;
            if let Some(prev) = prev_net_sample.as_ref() {
                if let Some((prx, ptx)) = prev.get(&name) {
                    rx_rate = ((rx.saturating_sub(*prx)) as f64 / elapsed / 1024.0).max(0.0);
                    tx_rate = ((tx.saturating_sub(*ptx)) as f64 / elapsed / 1024.0).max(0.0);
                }
            }
            net_up += tx_rate;
            net_down += rx_rate;
            if name != "lo" {
                nics.push(json!({ "name": name, "ip": "-", "rxRate": round1(rx_rate), "txRate": round1(tx_rate), "rxTotal": rx, "txTotal": tx }));
            }
        }
    }
    *prev_net_sample = Some(current_net_sample);
    (net_up, net_down, net_total_up, net_total_down, nics)
}

fn parse_processes(ps_lines: &[&str]) -> Vec<Value> {
    let mut processes = Vec::new();
    for line in ps_lines.iter().skip(1) {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 11 { continue; }
        let pid = cols.get(1).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
        let cpu = cols.get(2).unwrap_or(&"0").to_string() + "%";
        let mem = cols.get(3).unwrap_or(&"0").to_string() + "%";
        let name = cols.get(10).unwrap_or(&"").split('/').last().unwrap_or("").split_whitespace().next().unwrap_or("").to_string();
        processes.push(json!({
            "name": if name.is_empty() { cols.get(10).unwrap_or(&"").to_string() } else { name },
            "pid": pid, "cpu": cpu, "mem": mem,
        }));
    }
    processes
}
