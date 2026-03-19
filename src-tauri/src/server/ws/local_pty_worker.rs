/* ── 本地终端 PTY Worker ── */

use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::sync::mpsc;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use std::thread;
use std::time::Duration;

/* ── 类型 ── */

#[derive(Clone)]
pub struct LocalPtyWorker {
    pub tx: mpsc::Sender<LocalPtyReq>,
}

#[derive(Debug)]
pub enum LocalPtyReq {
    Input(String),
    Resize { cols: u32, rows: u32 },
    Disconnect,
}

/* ── Worker 启动 ── */

pub fn start_local_pty_worker(
    connect: Value,
    event_tx: tokio::sync::mpsc::UnboundedSender<Value>,
) -> Result<LocalPtyWorker, String> {
    let shell_key = connect.get("shell").and_then(|v| v.as_str()).ok_or("缺少 Shell 类型")?.to_string();
    let shell_exe = match shell_key.as_str() {
        "cmd" => "cmd.exe",
        "bash" => "bash",
        "powershell" => "powershell.exe",
        "powershell7" => "pwsh.exe",
        "wsl" => "wsl.exe",
        "zsh" => "zsh",
        "fish" => "fish",
        _ => return Err(format!("不支持的 Shell 类型: {}", shell_key)),
    }.to_string();

    let working_dir = connect.get("workingDir").and_then(|v| v.as_str()).map(|s| s.to_string());
    if let Some(dir) = &working_dir {
        match std::fs::metadata(dir) {
            Ok(meta) => {
                if !meta.is_dir() {
                    return Err(format!("工作路径不是目录: {}", dir));
                }
            }
            Err(_) => return Err(format!("工作路径不存在或无法访问: {}", dir)),
        }
    }

    let initial_command = connect.get("initialCommand").and_then(|v| v.as_str()).map(|s| s.to_string());
    let cols = connect.get("cols").and_then(|v| v.as_u64()).unwrap_or(120).max(80).min(500) as u16;
    let rows = connect.get("rows").and_then(|v| v.as_u64()).unwrap_or(30).max(24).min(200) as u16;

    let (tx, rx) = mpsc::channel::<LocalPtyReq>();

    thread::spawn(move || {
        let pty_system = native_pty_system();
        let pair = match pty_system.openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }) {
            Ok(p) => p,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "error", "data": format!("创建 PTY 失败: {}", e) }));
                return;
            }
        };

        let mut cmd = CommandBuilder::new(shell_exe);
        if let Some(dir) = &working_dir {
            cmd.cwd(dir);
        }
        let mut child = match pair.slave.spawn_command(cmd) {
            Ok(c) => c,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "error", "data": format!("启动 Shell 失败: {}", e) }));
                return;
            }
        };
        drop(pair.slave);

        let master = pair.master;
        let mut writer = match master.take_writer() {
            Ok(w) => w,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "status", "data": format!("writer 初始化失败: {e}") }));
                return;
            }
        };
        let mut reader = match master.try_clone_reader() {
            Ok(r) => r,
            Err(e) => {
                let _ = event_tx.send(json!({ "type": "error", "data": format!("读取 PTY 失败: {}", e) }));
                return;
            }
        };

        let running = Arc::new(AtomicBool::new(true));
        let running_reader = running.clone();
        let event_tx_reader = event_tx.clone();

        // 读取线程
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            while running_reader.load(Ordering::SeqCst) {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = event_tx_reader.send(json!({ "type": "output", "data": text }));
                    }
                    Err(_) => break,
                }
            }
            running_reader.store(false, Ordering::SeqCst);
            let _ = event_tx_reader.send(json!({ "type": "status", "data": "closed" }));
        });

        let _ = event_tx.send(json!({ "type": "status", "data": "connected" }));

        if let Some(cmd) = initial_command {
            thread::sleep(Duration::from_millis(300));
            let _ = writer.write_all(format!("{cmd}\r").as_bytes());
        }

        // 主循环
        loop {
            while let Ok(req) = rx.try_recv() {
                match req {
                    LocalPtyReq::Input(data) => {
                        let _ = writer.write_all(data.as_bytes());
                        let _ = writer.flush();
                    }
                    LocalPtyReq::Resize { cols, rows } => {
                        let _ = master.resize(PtySize { rows: rows as u16, cols: cols as u16, pixel_width: 0, pixel_height: 0 });
                    }
                    LocalPtyReq::Disconnect => {
                        running.store(false, Ordering::SeqCst);
                        let _ = child.kill();
                    }
                }
            }
            if !running.load(Ordering::SeqCst) {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        let _ = child.wait();
    });

    Ok(LocalPtyWorker { tx })
}
