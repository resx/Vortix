use serde_json::{Value, json};
use std::collections::HashMap;

pub(super) fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}

pub(super) fn parse_cpu_total(
    stat_lines: &[&str],
    prev_cpu_sample: &mut Option<Vec<u64>>,
) -> (f64, f64, f64, f64) {
    let mut cpu_usage = 0.0;
    let mut cpu_kernel = 0.0;
    let mut cpu_user = 0.0;
    let mut cpu_io = 0.0;
    if let Some(line) = stat_lines.first() {
        let fields: Vec<u64> = line
            .replace("cpu", "")
            .split_whitespace()
            .filter_map(|v| v.parse::<u64>().ok())
            .collect();
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
                    cpu_kernel = round1(
                        ((curr_system.saturating_sub(prev_system)) as f64 / d_total) * 100.0,
                    );
                    let curr_user = *fields.get(0).unwrap_or(&0) + *fields.get(1).unwrap_or(&0);
                    let prev_user = *prev.get(0).unwrap_or(&0) + *prev.get(1).unwrap_or(&0);
                    cpu_user =
                        round1(((curr_user.saturating_sub(prev_user)) as f64 / d_total) * 100.0);
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

pub(super) fn parse_cpu_per_core(
    stat_lines: &[&str],
    prev_per_core_samples: &mut Option<Vec<Vec<u64>>>,
) -> Vec<f64> {
    let mut cpu_per_core: Vec<f64> = Vec::new();
    let mut per_core_samples: Vec<Vec<u64>> = Vec::new();
    for line in stat_lines.iter().skip(1) {
        if !line.starts_with("cpu") {
            break;
        }
        let fields: Vec<u64> = line
            .replace("cpu", "")
            .split_whitespace()
            .filter_map(|v| v.parse::<u64>().ok())
            .collect();
        if fields.len() < 5 {
            continue;
        }
        if let Some(prev_list) = prev_per_core_samples.as_ref() {
            if let Some(prev) = prev_list.get(per_core_samples.len()) {
                let total: u64 = fields.iter().sum();
                let prev_total: u64 = prev.iter().sum();
                let d_total = total.saturating_sub(prev_total) as f64;
                let idle = *fields.get(3).unwrap_or(&0) + *fields.get(4).unwrap_or(&0);
                let prev_idle = *prev.get(3).unwrap_or(&0) + *prev.get(4).unwrap_or(&0);
                let d_idle = idle.saturating_sub(prev_idle) as f64;
                let val = if d_total > 0.0 {
                    ((1.0 - d_idle / d_total) * 100.0).round()
                } else {
                    0.0
                };
                cpu_per_core.push(val);
            } else {
                cpu_per_core.push(0.0);
            }
        } else {
            cpu_per_core.push(0.0);
        }
        per_core_samples.push(fields);
    }
    *prev_per_core_samples = Some(per_core_samples);
    cpu_per_core
}

pub(super) fn parse_memory(mem_lines: &[&str]) -> (f64, f64, f64, f64) {
    let mut mem_map: HashMap<String, u64> = HashMap::new();
    for line in mem_lines {
        let mut parts = line.split_whitespace();
        if let (Some(key), Some(val)) = (parts.next(), parts.next()) {
            let k = key.trim_end_matches(':').to_string();
            if let Ok(v) = val.parse::<u64>() {
                mem_map.insert(k, v);
            }
        }
    }
    let mem_total_kb = *mem_map.get("MemTotal").unwrap_or(&0) as f64;
    let mem_available_kb = if let Some(v) = mem_map.get("MemAvailable") {
        *v as f64
    } else {
        (*mem_map.get("MemFree").unwrap_or(&0)
            + *mem_map.get("Buffers").unwrap_or(&0)
            + *mem_map.get("Cached").unwrap_or(&0)) as f64
    };
    let mem_used = round1(((mem_total_kb - mem_available_kb) / 1024.0).max(0.0));
    let mem_total = round1(mem_total_kb / 1024.0);
    let swap_total = round1((*mem_map.get("SwapTotal").unwrap_or(&0) as f64) / 1024.0);
    let swap_used = round1(
        ((*mem_map.get("SwapTotal").unwrap_or(&0) - *mem_map.get("SwapFree").unwrap_or(&0)) as f64
            / 1024.0)
            .max(0.0),
    );
    (mem_used, mem_total, swap_used, swap_total)
}

pub(super) fn parse_disks(df_lines: &[&str]) -> Vec<Value> {
    let mut disks = Vec::new();
    for line in df_lines {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 6 {
            continue;
        }
        let total_b = cols.get(1).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        let used_b = cols.get(2).and_then(|v| v.parse::<u64>().ok()).unwrap_or(0);
        if total_b == 0 {
            continue;
        }
        let total = round1(total_b as f64 / (1024.0 * 1024.0 * 1024.0));
        let used = round1(used_b as f64 / (1024.0 * 1024.0 * 1024.0));
        let percent = ((used_b as f64 / total_b as f64) * 100.0).floor();
        disks.push(json!({
            "name": cols[0],
            "used": used,
            "total": total,
            "percent": percent,
            "path": cols[5]
        }));
    }
    disks
}

pub(super) fn parse_network(
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
            if cols.len() < 9 {
                continue;
            }
            let rx = cols
                .first()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(0);
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
                nics.push(json!({
                    "name": name,
                    "ip": "-",
                    "rxRate": round1(rx_rate),
                    "txRate": round1(tx_rate),
                    "rxTotal": rx,
                    "txTotal": tx
                }));
            }
        }
    }
    *prev_net_sample = Some(current_net_sample);
    (net_up, net_down, net_total_up, net_total_down, nics)
}

pub(super) fn parse_processes(ps_lines: &[&str]) -> Vec<Value> {
    let mut processes = Vec::new();
    for line in ps_lines.iter().skip(1) {
        let cols: Vec<&str> = line.split_whitespace().collect();
        if cols.len() < 11 {
            continue;
        }
        let pid = cols.get(1).and_then(|v| v.parse::<u32>().ok()).unwrap_or(0);
        let cpu = cols.get(2).unwrap_or(&"0").to_string() + "%";
        let mem = cols.get(3).unwrap_or(&"0").to_string() + "%";
        let name = cols
            .get(10)
            .unwrap_or(&"")
            .split('/')
            .last()
            .unwrap_or("")
            .split_whitespace()
            .next()
            .unwrap_or("")
            .to_string();
        processes.push(json!({
            "name": if name.is_empty() { cols.get(10).unwrap_or(&"").to_string() } else { name },
            "pid": pid,
            "cpu": cpu,
            "mem": mem,
        }));
    }
    processes
}
