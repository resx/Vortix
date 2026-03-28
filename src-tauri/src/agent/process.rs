use std::path::PathBuf;
use tokio::process::{Child, Command};

#[cfg(target_os = "windows")]
const AGENT_EXECUTABLE: &str = "vortix-agent.exe";
#[cfg(not(target_os = "windows"))]
const AGENT_EXECUTABLE: &str = "vortix-agent";

pub fn resolve_agent_binary(base_dir: &PathBuf) -> PathBuf {
    base_dir.join(AGENT_EXECUTABLE)
}

pub fn detect_agent_binary(base_dir: &PathBuf) -> Option<PathBuf> {
    for directory in candidate_directories(base_dir) {
        let preferred = resolve_agent_binary(&directory);
        if preferred.is_file() {
            return Some(preferred);
        }
        if let Some(path) = scan_agent_binary(&directory) {
            return Some(path);
        }
    }

    None
}

fn candidate_directories(base_dir: &PathBuf) -> [PathBuf; 2] {
    [base_dir.clone(), base_dir.join("binaries")]
}

fn scan_agent_binary(directory: &PathBuf) -> Option<PathBuf> {
    let stem = AGENT_EXECUTABLE.strip_suffix(".exe").unwrap_or(AGENT_EXECUTABLE);
    let entries = std::fs::read_dir(directory).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if !file_name.starts_with(stem) {
            continue;
        }
        #[cfg(target_os = "windows")]
        if !file_name.ends_with(".exe") {
            continue;
        }
        return Some(path);
    }
    None
}

pub fn spawn_agent_process(binary: PathBuf, endpoint: &str) -> Result<Child, String> {
    let mut command = Command::new(binary);
    command
        .arg("--transport")
        .arg("named-pipe")
        .arg("--endpoint")
        .arg(endpoint)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    command.spawn().map_err(|e| e.to_string())
}
