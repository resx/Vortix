use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::Duration;
use tokio::task;
use tokio::time;

use crate::server::types::SyncRequestBody;

use super::GitProvider;

fn resolve_cache_root() -> PathBuf {
    if let Ok(value) = std::env::var("VORTIX_HOME") {
        return PathBuf::from(value).join("cache");
    }
    if let Some(data_dir) = dirs::data_dir() {
        return data_dir.join("Vortix").join("cache");
    }
    std::env::temp_dir().join("Vortix").join("cache")
}

fn canonicalize_ssh_key(raw: &str) -> String {
    let mut key = raw.trim().trim_matches('"').to_string();
    if key.contains("\\n") && !key.contains('\n') {
        key = key.replace("\\r\\n", "\n").replace("\\n", "\n");
    }
    key = key.replace("\r\n", "\n").replace('\r', "\n");
    if key.starts_with('\u{feff}') {
        key = key.trim_start_matches('\u{feff}').to_string();
    }
    if !key.ends_with('\n') {
        key.push('\n');
    }
    key
}

impl GitProvider {
    pub(crate) const TEST_TIMEOUT_SECS: u64 = 15;
    pub(crate) const READ_TIMEOUT_SECS: u64 = 30;
    pub(crate) const WRITE_TIMEOUT_SECS: u64 = 60;

    pub fn new(body: &SyncRequestBody) -> Result<Self, String> {
        let url = body.sync_git_url.clone().ok_or("syncGitUrl required")?;
        Self::ensure_secure_remote_url(&url)?;
        let tls_verify = body.sync_tls_verify.unwrap_or(true);
        if !tls_verify && !Self::is_ssh_url(&url) {
            return Err("syncTlsVerify=false is disabled: Git HTTPS requires certificate verification".to_string());
        }

        let branch = body
            .sync_git_branch
            .clone()
            .unwrap_or_else(|| "master".to_string());
        let subdir = body.sync_git_path.clone().unwrap_or_default();
        let hash = URL_SAFE_NO_PAD.encode(url.as_bytes());
        let short = &hash[..hash.len().min(16)];
        let work_dir = resolve_cache_root().join("git-sync").join(short);
        let clean = subdir.trim().trim_matches('/').replace('\\', "/");
        let sync_rel_path = if clean.is_empty() {
            "vortix.json".to_string()
        } else {
            format!("{}/vortix.json", clean)
        };
        let ssh_key = body
            .sync_git_ssh_key
            .as_deref()
            .filter(|k| !k.trim().is_empty())
            .map(canonicalize_ssh_key);

        Ok(Self {
            url,
            branch,
            subdir: clean,
            sync_rel_path,
            username: body.sync_git_username.clone(),
            password: body.sync_git_password.clone(),
            ssh_key,
            work_dir,
        })
    }

    pub(crate) fn is_ssh_url(url: &str) -> bool {
        let lowered = url.trim().to_lowercase();
        lowered.starts_with("git@") || lowered.starts_with("ssh://")
    }

    pub(crate) fn ensure_secure_remote_url(url: &str) -> Result<(), String> {
        if Self::is_ssh_url(url) {
            return Ok(());
        }
        let parsed = url::Url::parse(url).map_err(|_| {
            "syncGitUrl invalid: only ssh://, git@, or https:// are supported".to_string()
        })?;
        match parsed.scheme() {
            "https" => Ok(()),
            "http" => Err("Git over HTTP is not allowed; use HTTPS or SSH".to_string()),
            _ => Err("syncGitUrl invalid: only ssh://, git@, or https:// are supported".to_string()),
        }
    }

    pub(crate) fn repo_root(&self) -> PathBuf {
        self.work_dir.clone()
    }

    pub(crate) fn key_to_path(&self, key: &str) -> PathBuf {
        let mut path = self.repo_root();
        if !self.subdir.is_empty() {
            path = path.join(&self.subdir);
        }
        path.join(key.trim_start_matches('/'))
    }

    pub(crate) fn is_ssh(&self) -> bool {
        Self::is_ssh_url(&self.url)
    }

    pub(crate) fn has_repo(&self) -> bool {
        self.work_dir.join(".git").exists()
    }

    pub(crate) fn write_temp_key(&self) -> Result<Option<PathBuf>, String> {
        let Some(ref key) = self.ssh_key else {
            return Ok(None);
        };
        let path = std::env::temp_dir().join(format!("vortix-git-key-{}", uuid::Uuid::new_v4()));
        fs::write(&path, key).map_err(|e| format!("写入临时 SSH 密钥失败: {}", e))?;
        Ok(Some(path))
    }

    fn http_extra_header_config(&self) -> Option<String> {
        if self.is_ssh() {
            return None;
        }
        let user = self.username.as_deref().filter(|v| !v.trim().is_empty())?;
        let pass = self.password.as_deref().filter(|v| !v.is_empty())?;
        let token = STANDARD.encode(format!("{}:{}", user, pass));
        Some(format!("http.extraHeader=Authorization: Basic {}", token))
    }

    fn apply_http_auth_config(&self, cmd: &mut Command) {
        if let Some(config) = self.http_extra_header_config() {
            cmd.arg("-c").arg(config);
        }
    }

    pub(crate) fn git_cmd(&self, key_path: Option<&Path>) -> Command {
        let mut cmd = Command::new("git");
        cmd.current_dir(&self.work_dir);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        self.apply_http_auth_config(&mut cmd);
        if let Some(kp) = key_path {
            let ssh_cmd = format!(
                "ssh -i \"{}\" -o StrictHostKeyChecking=no -o BatchMode=yes",
                kp.to_string_lossy().replace('\\', "/")
            );
            cmd.env("GIT_SSH_COMMAND", ssh_cmd);
        }
        cmd.env("GIT_TERMINAL_PROMPT", "0");
        cmd
    }

    pub(crate) fn git_cmd_no_workdir(&self, key_path: Option<&Path>) -> Command {
        let mut cmd = Command::new("git");
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        self.apply_http_auth_config(&mut cmd);
        if let Some(kp) = key_path {
            let ssh_cmd = format!(
                "ssh -i \"{}\" -o StrictHostKeyChecking=no -o BatchMode=yes",
                kp.to_string_lossy().replace('\\', "/")
            );
            cmd.env("GIT_SSH_COMMAND", ssh_cmd);
        }
        cmd.env("GIT_TERMINAL_PROMPT", "0");
        cmd
    }

    pub(crate) fn run_output(output: Output, label: &str) -> Result<String, String> {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        if output.status.success() {
            Ok(stdout)
        } else {
            let detail = if !stderr.trim().is_empty() {
                stderr.trim().to_string()
            } else {
                stdout.trim().to_string()
            };
            Err(format!("git {} 失败: {}", label, detail))
        }
    }

    pub(crate) async fn run_blocking<T, F>(
        &self,
        label: &'static str,
        timeout_secs: u64,
        op: F,
    ) -> Result<T, String>
    where
        T: Send + 'static,
        F: FnOnce(GitProvider) -> Result<T, String> + Send + 'static,
    {
        let provider = self.clone();
        let join = task::spawn_blocking(move || op(provider));
        match time::timeout(Duration::from_secs(timeout_secs), join).await {
            Ok(Ok(result)) => result,
            Ok(Err(join_err)) => Err(format!("git {} task failed: {}", label, join_err)),
            Err(_) => Err(format!("git {} timed out after {}s", label, timeout_secs)),
        }
    }
}
