pub mod bridge;
pub mod bridge_connections;
pub mod bridge_folders;
pub mod bridge_shortcuts;
pub mod process;
pub mod types;

use std::path::PathBuf;
use std::sync::Arc;
use tokio::process::Child;
use std::sync::Mutex;

use process::{detect_agent_binary, resolve_agent_binary, spawn_agent_process};
pub use types::AgentStatus;

#[derive(Default)]
struct AgentRuntime {
    child: Option<Child>,
    last_error: Option<String>,
}

#[derive(Clone)]
pub struct AgentState {
    enabled: bool,
    endpoint: String,
    binary_path: PathBuf,
    runtime: Arc<Mutex<AgentRuntime>>,
}

impl AgentState {
    pub fn new(base_dir: PathBuf) -> Self {
        let endpoint = default_agent_endpoint();
        let binary_path = detect_agent_binary(&base_dir).unwrap_or_else(|| resolve_agent_binary(&base_dir));
        let enabled = binary_path.is_file();
        let runtime = AgentRuntime {
            child: None,
            last_error: if enabled {
                None
            } else {
                Some("vortix-agent 未构建，已自动降级为内嵌服务".to_string())
            },
        };
        Self {
            enabled,
            endpoint,
            binary_path,
            runtime: Arc::new(Mutex::new(runtime)),
        }
    }

    pub fn try_start(&self) {
        if !self.enabled {
            return;
        }
        let mut guard = self.runtime.lock().expect("agent runtime mutex poisoned");
        if guard.child.is_some() {
            return;
        }
        match spawn_agent_process(self.binary_path.clone(), &self.endpoint) {
            Ok(child) => {
                let pid = child.id();
                guard.last_error = None;
                guard.child = Some(child);
                tracing::info!(
                    "[Vortix] vortix-agent 已启动: pid={:?}, endpoint={}, binary={}",
                    pid,
                    self.endpoint,
                    self.binary_path.display()
                );
            }
            Err(error) => {
                guard.last_error = Some(error.clone());
                tracing::warn!("[Vortix] 启动 vortix-agent 失败（当前降级为内嵌服务）：{error}");
            }
        }
    }

    pub fn shutdown(&self) {
        let mut guard = self.runtime.lock().expect("agent runtime mutex poisoned");
        let Some(child) = guard.child.as_mut() else {
            return;
        };
        if let Err(error) = child.start_kill() {
            let message = format!("停止 agent 失败: {error}");
            guard.last_error = Some(message.clone());
            tracing::warn!("[Vortix] {message}");
            return;
        }
        guard.child = None;
        guard.last_error = None;
    }

    pub fn status(&self) -> AgentStatus {
        let mut guard = self.runtime.lock().expect("agent runtime mutex poisoned");
        let mut running = false;
        let mut pid = None;
        if let Some(child) = guard.child.as_mut() {
            match child.try_wait() {
                Ok(None) => {
                    running = true;
                    pid = child.id();
                }
                Ok(Some(status)) => {
                    guard.last_error = Some(format!("agent 已退出: {status}"));
                    guard.child = None;
                }
                Err(err) => {
                    guard.last_error = Some(format!("agent 状态检测失败: {err}"));
                    guard.child = None;
                }
            }
        }
        AgentStatus {
            enabled: self.enabled,
            running,
            pid,
            endpoint: self.endpoint.clone(),
            transport: if self.enabled {
                "named-pipe".to_string()
            } else {
                "embedded".to_string()
            },
            binary_path: self.binary_path.display().to_string(),
            last_error: guard.last_error.clone(),
        }
    }
}

#[cfg(target_os = "windows")]
fn default_agent_endpoint() -> String {
    r"\\.\pipe\vortix-agent".to_string()
}

#[cfg(not(target_os = "windows"))]
fn default_agent_endpoint() -> String {
    "/tmp/vortix-agent.sock".to_string()
}
