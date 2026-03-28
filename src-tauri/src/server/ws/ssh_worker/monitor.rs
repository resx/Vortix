#[path = "monitor_parsers.rs"]
mod monitor_parsers;

use russh::client;
use serde_json::{Value, json};
use std::collections::HashMap;
use std::time::Instant;

use crate::server::helpers::KnownHostsHandler;

use monitor_parsers::{
    parse_cpu_per_core, parse_cpu_total, parse_disks, parse_memory, parse_network,
    parse_processes, round1,
};

pub(super) async fn handle_monitor_init(
    handle: &client::Handle<KnownHostsHandler>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    cpu_core_count: &mut u32,
) {
    if let Ok(raw) = super::russh_exec(handle, "uname -sr; echo \"===SEP===\"; hostname; echo \"===SEP===\"; whoami; echo \"===SEP===\"; cat /proc/uptime; echo \"===SEP===\"; nproc").await {
        let parts: Vec<&str> = raw.split("===SEP===").map(|s| s.trim()).collect();
        let os = parts.first().copied().unwrap_or("Linux");
        let host = parts.get(1).copied().unwrap_or("unknown");
        let user = parts.get(2).copied().unwrap_or("unknown");
        let uptime_sec = parts
            .get(3)
            .and_then(|s| s.split_whitespace().next())
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);
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

#[allow(clippy::too_many_arguments)]
pub(super) async fn collect_monitor_snapshot(
    handle: &client::Handle<KnownHostsHandler>,
    event_tx: &tokio::sync::mpsc::UnboundedSender<Value>,
    prev_cpu_sample: &mut Option<Vec<u64>>,
    prev_per_core_samples: &mut Option<Vec<Vec<u64>>>,
    prev_net_sample: &mut Option<HashMap<String, (u64, u64)>>,
    prev_sample_time: &mut Option<Instant>,
    cpu_core_count: u32,
) {
    let cmd = "cat /proc/stat; echo \"===SEP===\"; cat /proc/meminfo | grep -E \"^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):\"; echo \"===SEP===\"; df -B1 2>/dev/null | tail -n +2; echo \"===SEP===\"; cat /proc/net/dev | tail -n +3; echo \"===SEP===\"; ps aux --sort=-%cpu 2>/dev/null | head -11";
    let Ok(raw) = super::russh_exec(handle, cmd).await else {
        return;
    };

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
    let elapsed = prev_sample_time
        .map(|t| now.duration_since(t).as_secs_f64())
        .unwrap_or(3.0);
    *prev_sample_time = Some(now);
    let (net_up, net_down, net_total_up, net_total_down, nics) =
        parse_network(&net_lines, prev_net_sample, elapsed);
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
