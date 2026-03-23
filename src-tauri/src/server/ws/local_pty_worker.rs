/* Local PTY Worker */

use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use serde_json::{Value, json};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use std::thread;
use std::time::Duration;

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

pub fn local_shell_executable(shell_key: &str) -> Option<&'static str> {
    match shell_key {
        "cmd" => Some("cmd.exe"),
        "bash" => Some("bash"),
        "powershell" => Some("powershell.exe"),
        "powershell7" => Some("pwsh.exe"),
        "wsl" => Some("wsl.exe"),
        "zsh" => Some("zsh"),
        "fish" => Some("fish"),
        _ => None,
    }
}

fn validate_working_dir(path: &str) -> Result<(), String> {
    match std::fs::metadata(path) {
        Ok(meta) => {
            if meta.is_dir() {
                Ok(())
            } else {
                Err(format!("工作目录不是文件夹: {}", path))
            }
        }
        Err(_) => Err(format!("工作目录不存在或不可访问: {}", path)),
    }
}

fn find_executable_in_path(command: &str) -> Option<PathBuf> {
    let command_path = Path::new(command);
    if command_path.is_absolute() && command_path.is_file() {
        return Some(command_path.to_path_buf());
    }

    let path_env = std::env::var_os("PATH")?;

    #[cfg(windows)]
    let extensions: Vec<String> = {
        if command_path.extension().is_some() {
            vec![String::new()]
        } else {
            let mut exts: Vec<String> = std::env::var_os("PATHEXT")
                .map(|raw| {
                    raw.to_string_lossy()
                        .split(';')
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(|s| s.to_string())
                        .collect()
                })
                .unwrap_or_default();
            if exts.is_empty() {
                exts = vec![
                    ".COM".to_string(),
                    ".EXE".to_string(),
                    ".BAT".to_string(),
                    ".CMD".to_string(),
                ];
            }
            exts
        }
    };

    for dir in std::env::split_paths(&path_env) {
        if !dir.is_dir() {
            continue;
        }

        #[cfg(windows)]
        {
            for ext in &extensions {
                let candidate = if ext.is_empty() {
                    dir.join(command)
                } else {
                    dir.join(format!("{command}{ext}"))
                };
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }

        #[cfg(not(windows))]
        {
            let candidate = dir.join(command);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    None
}

fn resolve_default_working_dir(shell_exe: &str) -> Option<String> {
    if let Some(exe_path) = find_executable_in_path(shell_exe) {
        if let Some(parent) = exe_path.parent() {
            if parent.is_dir() {
                return Some(parent.to_string_lossy().to_string());
            }
        }
    }
    None
}

pub fn resolve_local_shell_working_dir(
    shell_exe: &str,
    requested_working_dir: Option<String>,
) -> Result<Option<String>, String> {
    if let Some(dir) = requested_working_dir {
        validate_working_dir(&dir)?;
        return Ok(Some(dir));
    }

    if let Some(default_dir) = resolve_default_working_dir(shell_exe) {
        if validate_working_dir(&default_dir).is_ok() {
            return Ok(Some(default_dir));
        }
    }

    Ok(None)
}

pub fn start_local_pty_worker(
    connect: Value,
    event_tx: tokio::sync::mpsc::UnboundedSender<Value>,
) -> Result<LocalPtyWorker, String> {
    let shell_key = connect
        .get("shell")
        .and_then(|v| v.as_str())
        .ok_or("缺少 Shell 参数")?
        .to_string();

    let shell_exe = local_shell_executable(&shell_key)
        .ok_or_else(|| format!("不支持的 Shell 类型: {}", shell_key))?
        .to_string();

    let requested_working_dir = connect
        .get("workingDir")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let working_dir = resolve_local_shell_working_dir(&shell_exe, requested_working_dir)?;

    let initial_command = connect
        .get("initialCommand")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let cols = connect
        .get("cols")
        .and_then(|v| v.as_u64())
        .unwrap_or(120)
        .max(80)
        .min(500) as u16;
    let rows = connect
        .get("rows")
        .and_then(|v| v.as_u64())
        .unwrap_or(30)
        .max(24)
        .min(200) as u16;

    let (tx, rx) = mpsc::channel::<LocalPtyReq>();

    thread::spawn(move || {
        let pty_system = native_pty_system();
        let pair = match pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }) {
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
                let _ = event_tx.send(json!({ "type": "error", "data": format!("创建 PTY reader 失败: {}", e) }));
                return;
            }
        };

        let running = Arc::new(AtomicBool::new(true));
        let running_reader = running.clone();
        let event_tx_reader = event_tx.clone();

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

        loop {
            while let Ok(req) = rx.try_recv() {
                match req {
                    LocalPtyReq::Input(data) => {
                        let _ = writer.write_all(data.as_bytes());
                        let _ = writer.flush();
                    }
                    LocalPtyReq::Resize { cols, rows } => {
                        let _ = master.resize(PtySize {
                            rows: rows as u16,
                            cols: cols as u16,
                            pixel_width: 0,
                            pixel_height: 0,
                        });
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
