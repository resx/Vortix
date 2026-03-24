use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use bytes::Bytes;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::Duration;
use tokio::task;
use tokio::time;

use super::SyncProvider;
use crate::server::types::{RemoteCheckResult, SyncFileInfo, SyncRequestBody};
use crate::time_utils::now_rfc3339;

fn resolve_cache_root() -> PathBuf {
    if let Ok(value) = std::env::var("VORTIX_HOME") {
        return PathBuf::from(value).join("cache");
    }

    if let Some(data_dir) = dirs::data_dir() {
        return data_dir.join("Vortix").join("cache");
    }

    std::env::temp_dir().join("Vortix").join("cache")
}

/// 规范化 SSH 私钥文本（处理转义换行、BOM、CRLF 等）
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

#[derive(Clone)]
pub struct GitProvider {
    url: String,
    branch: String,
    subdir: String,
    sync_rel_path: String,
    username: Option<String>,
    password: Option<String>,
    ssh_key: Option<String>,
    work_dir: PathBuf,
}

impl GitProvider {
    const TEST_TIMEOUT_SECS: u64 = 15;
    const READ_TIMEOUT_SECS: u64 = 30;
    const WRITE_TIMEOUT_SECS: u64 = 60;
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

    fn is_ssh_url(url: &str) -> bool {
        let lowered = url.trim().to_lowercase();
        lowered.starts_with("git@") || lowered.starts_with("ssh://")
    }

    fn ensure_secure_remote_url(url: &str) -> Result<(), String> {
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

    // ── 路径工具 ──

    fn repo_root(&self) -> PathBuf {
        self.work_dir.clone()
    }

    fn key_to_path(&self, key: &str) -> PathBuf {
        let mut path = self.repo_root();
        if !self.subdir.is_empty() {
            path = path.join(&self.subdir);
        }
        path.join(key.trim_start_matches('/'))
    }

    fn is_ssh(&self) -> bool {
        Self::is_ssh_url(&self.url)
    }

    fn has_repo(&self) -> bool {
        self.work_dir.join(".git").exists()
    }
    // ── SSH 密钥临时文件管理 ──

    /// 将 SSH 密钥写入临时文件，返回路径。调用方负责清理。
    fn write_temp_key(&self) -> Result<Option<PathBuf>, String> {
        let Some(ref key) = self.ssh_key else {
            return Ok(None);
        };
        let path = std::env::temp_dir().join(format!("vortix-git-key-{}", uuid::Uuid::new_v4()));
        fs::write(&path, key).map_err(|e| format!("写入临时 SSH 密钥失败: {}", e))?;
        Ok(Some(path))
    }

    /// 构建 git 命令的 HTTP Basic Header 配置（避免将凭据放入 URL）
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

    // ── git 命令执行 ──

    /// 构建带认证环境变量的 git Command
    fn git_cmd(&self, key_path: Option<&Path>) -> Command {
        let mut cmd = Command::new("git");
        cmd.current_dir(&self.work_dir);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        self.apply_http_auth_config(&mut cmd);

        // SSH 密钥
        if let Some(kp) = key_path {
            let ssh_cmd = format!(
                "ssh -i \"{}\" -o StrictHostKeyChecking=no -o BatchMode=yes",
                kp.to_string_lossy().replace('\\', "/")
            );
            cmd.env("GIT_SSH_COMMAND", ssh_cmd);
        }

        // 禁止交互式提示
        cmd.env("GIT_TERMINAL_PROMPT", "0");

        cmd
    }

    /// 在 work_dir 不存在时用于执行 clone 等命令的 Command（不设 current_dir）
    fn git_cmd_no_workdir(&self, key_path: Option<&Path>) -> Command {
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

    fn run_output(output: Output, label: &str) -> Result<String, String> {
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
    // ── 高层 git 操作 ──

    fn test_remote_connection(&self) -> Result<(), String> {
        let key_path = self.write_temp_key()?;
        let result = (|| {
            let output = self
                .git_cmd_no_workdir(key_path.as_deref())
                .arg("ls-remote")
                .arg("--heads")
                .arg(&self.url)
                .output()
                .map_err(|e| format!("启动 git 失败（请确认已安装 git）: {}", e))?;
            Self::run_output(output, "ls-remote")
        })();
        if let Some(ref p) = key_path {
            let _ = fs::remove_file(p);
        }
        result.map(|_| ())
    }

    fn remote_branch_exists(&self) -> Result<bool, String> {
        let key_path = self.write_temp_key()?;
        let result = (|| {
            let output = self
                .git_cmd_no_workdir(key_path.as_deref())
                .arg("ls-remote")
                .arg("--heads")
                .arg(&self.url)
                .arg(&self.branch)
                .output()
                .map_err(|e| format!("启动 git 失败: {}", e))?;
            let stdout = Self::run_output(output, "ls-remote")?;
            Ok(!stdout.trim().is_empty())
        })();
        if let Some(ref p) = key_path {
            let _ = fs::remove_file(p);
        }
        result
    }

    fn clone_repo(&self) -> Result<(), String> {
        self.remove_workdir()?;
        if let Some(parent) = self.work_dir.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let key_path = self.write_temp_key()?;
        let result = (|| {
            let output = self
                .git_cmd_no_workdir(key_path.as_deref())
                .args([
                    "clone",
                    "--branch",
                    &self.branch,
                    "--single-branch",
                    "--depth",
                    "1",
                ])
                .arg(&self.url)
                .arg(&self.work_dir.to_string_lossy().as_ref())
                .output()
                .map_err(|e| format!("启动 git clone 失败: {}", e))?;
            Self::run_output(output, "clone")
        })();
        if let Some(ref p) = key_path {
            let _ = fs::remove_file(p);
        }
        result.map(|_| ())?;
        self.configure_repo()
    }

    fn init_empty_repo(&self) -> Result<(), String> {
        self.remove_workdir()?;
        fs::create_dir_all(&self.work_dir).map_err(|e| e.to_string())?;
        let output = self
            .git_cmd(None)
            .args(["init", "-b", &self.branch])
            .output()
            .map_err(|e| format!("git init 失败: {}", e))?;
        Self::run_output(output, "init")?;
        self.configure_repo()?;
        // 添加 remote
        let output = self
            .git_cmd(None)
            .args(["remote", "add", "origin", &self.url])
            .output()
            .map_err(|e| e.to_string())?;
        Self::run_output(output, "remote add")?;
        Ok(())
    }

    fn configure_repo(&self) -> Result<(), String> {
        let output = self
            .git_cmd(None)
            .args(["config", "user.name", "Vortix Sync"])
            .output()
            .map_err(|e| e.to_string())?;
        Self::run_output(output, "config user.name")?;

        let output = self
            .git_cmd(None)
            .args(["config", "user.email", "sync@vortix.local"])
            .output()
            .map_err(|e| e.to_string())?;
        Self::run_output(output, "config user.email")?;

        // 确保 remote URL 正确
        let output = self
            .git_cmd(None)
            .args(["remote", "set-url", "origin", &self.url])
            .output()
            .map_err(|e| e.to_string())?;
        // set-url 可能失败（remote 不存在），忽略
        if !output.status.success() {
            let _ = self
                .git_cmd(None)
                .args(["remote", "add", "origin", &self.url])
                .output();
        }
        Ok(())
    }
    fn fetch_and_reset(&self) -> Result<(), String> {
        let key_path = self.write_temp_key()?;
        let result = (|| {
            self.configure_repo()?;
            let output = self
                .git_cmd(key_path.as_deref())
                .args(["fetch", "origin", &self.branch, "--depth", "1"])
                .output()
                .map_err(|e| format!("git fetch 失败: {}", e))?;
            Self::run_output(output, "fetch")?;

            let remote_ref = format!("origin/{}", self.branch);
            let output = self
                .git_cmd(None)
                .args(["reset", "--hard", &remote_ref])
                .output()
                .map_err(|e| e.to_string())?;
            Self::run_output(output, "reset")?;

            let output = self
                .git_cmd(None)
                .args(["clean", "-fd"])
                .output()
                .map_err(|e| e.to_string())?;
            Self::run_output(output, "clean")?;
            Ok(())
        })();
        if let Some(ref p) = key_path {
            let _ = fs::remove_file(p);
        }
        result
    }

    fn has_pending_changes(&self) -> Result<bool, String> {
        let output = self
            .git_cmd(None)
            .args(["status", "--porcelain"])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = Self::run_output(output, "status")?;
        Ok(!stdout.trim().is_empty())
    }

    fn remove_workdir(&self) -> Result<(), String> {
        if self.work_dir.exists() {
            fs::remove_dir_all(&self.work_dir).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    fn ensure_repo_for_read(&self) -> Result<(), String> {
        if self.has_repo() {
            if !self.has_pending_changes()? && self.remote_branch_exists()? {
                self.fetch_and_reset()?;
            }
            return Ok(());
        }
        if self.remote_branch_exists()? {
            return self.clone_repo();
        }
        Err("remote branch not found".to_string())
    }

    fn prepare_repo_for_mutation(&self) -> Result<(), String> {
        if self.has_repo() {
            if self.has_pending_changes()? {
                return Ok(());
            }
            if self.remote_branch_exists()? {
                self.fetch_and_reset()?;
            }
            return Ok(());
        }
        if self.remote_branch_exists()? {
            self.clone_repo()
        } else {
            self.init_empty_repo()
        }
    }

    fn cleanup_old_files(&self) -> Result<(), String> {
        let target = self.sync_rel_path.clone();
        let root = self.repo_root();
        let mut stack = vec![root.clone()];
        while let Some(dir) = stack.pop() {
            let entries = match fs::read_dir(&dir) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name();
                if name.to_string_lossy() == ".git" {
                    continue;
                }
                if path.is_dir() {
                    stack.push(path);
                    continue;
                }
                let rel = match path.strip_prefix(&root) {
                    Ok(r) => r.to_string_lossy().replace('\\', "/"),
                    Err(_) => continue,
                };
                let fname = rel.rsplit('/').next().unwrap_or("");
                if fname == "vortix-sync.dat"
                    || fname == "vortix-sync.manifest.json"
                    || fname == "vortix-sync.vxsync"
                    || (fname == "vortix-sync.json" && rel != target)
                    || (fname == "vortix.json" && rel != target)
                    || fname == "vortix"
                {
                    let _ = fs::remove_file(&path);
                }
            }
        }
        Ok(())
    }

    fn commit_and_push(&self) -> Result<(), String> {
        self.prepare_repo_for_mutation()?;
        self.cleanup_old_files()?;

        // stage all
        let output = self
            .git_cmd(None)
            .args(["add", "-A"])
            .output()
            .map_err(|e| e.to_string())?;
        Self::run_output(output, "add")?;

        // 检查是否有变更
        if !self.has_pending_changes()? {
            return Ok(());
        }

        let message = format!("chore: vortix sync {}", now_rfc3339());
        let output = self
            .git_cmd(None)
            .args(["commit", "--allow-empty", "-m", &message])
            .output()
            .map_err(|e| e.to_string())?;
        Self::run_output(output, "commit")?;

        // push (force 以处理 amend 场景)
        let key_path = self.write_temp_key()?;
        let result = (|| {
            let output = self
                .git_cmd(key_path.as_deref())
                .args(["push", "--force", "origin", &self.branch])
                .output()
                .map_err(|e| format!("git push 失败: {}", e))?;
            Self::run_output(output, "push")
        })();
        if let Some(ref p) = key_path {
            let _ = fs::remove_file(p);
        }
        result.map(|_| ())
    }

    /// 轻量级远端变更检测：仅用 ls-remote + rev-parse 对比 hash，不触发 fetch
    fn check_remote_hash(&self) -> Result<RemoteCheckResult, String> {
        // 本地 HEAD
        let local_hash = if self.has_repo() {
            let output = self
                .git_cmd(None)
                .args(["rev-parse", "HEAD"])
                .output()
                .map_err(|e| format!("git rev-parse 失败: {}", e))?;
            match Self::run_output(output, "rev-parse") {
                Ok(s) => s.trim().to_string(),
                Err(_) => String::new(),
            }
        } else {
            String::new()
        };

        // 远端 HEAD（仅网络查询，不下载对象）
        let key_path = self.write_temp_key()?;
        let result: Result<String, String> = (|| {
            let output = self
                .git_cmd_no_workdir(key_path.as_deref())
                .args(["ls-remote", "--heads"])
                .arg(&self.url)
                .arg(&self.branch)
                .output()
                .map_err(|e| format!("git ls-remote 失败: {}", e))?;
            let stdout = Self::run_output(output, "ls-remote")?;
            // 格式: "<hash>\trefs/heads/<branch>"
            let remote_hash = stdout.split_whitespace().next().unwrap_or("").to_string();
            Ok(remote_hash)
        })();
        if let Some(ref p) = key_path {
            let _ = fs::remove_file(p);
        }
        let remote_hash = result?;

        let has_update =
            !remote_hash.is_empty() && !local_hash.is_empty() && remote_hash != local_hash;
        Ok(RemoteCheckResult {
            has_update,
            remote_hash,
            local_hash,
        })
    }

    async fn run_blocking<T, F>(
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

#[async_trait]
impl SyncProvider for GitProvider {
    async fn read(&self, key: &str) -> Result<Bytes, String> {
        let key = key.to_string();
        self.run_blocking("read", Self::READ_TIMEOUT_SECS, move |p| {
            p.ensure_repo_for_read()?;
            let path = p.key_to_path(&key);
            let data = fs::read(&path).map_err(|e| e.to_string())?;
            Ok(Bytes::from(data))
        })
        .await
    }

    async fn write(&self, key: &str, data: Bytes) -> Result<(), String> {
        let key = key.to_string();
        self.run_blocking("write", Self::WRITE_TIMEOUT_SECS, move |p| {
            p.prepare_repo_for_mutation()?;
            let path = p.key_to_path(&key);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(&path, &data).map_err(|e| e.to_string())
        })
        .await
    }

    async fn delete(&self, key: &str) -> Result<(), String> {
        let key = key.to_string();
        self.run_blocking("delete", Self::WRITE_TIMEOUT_SECS, move |p| {
            p.prepare_repo_for_mutation()?;
            let path = p.key_to_path(&key);
            if path.exists() {
                fs::remove_file(&path).map_err(|e| e.to_string())?;
            }
            Ok(())
        })
        .await
    }

    async fn stat(&self, key: &str) -> Result<Option<SyncFileInfo>, String> {
        let key = key.to_string();
        self.run_blocking("stat", Self::READ_TIMEOUT_SECS, move |p| {
            match p.ensure_repo_for_read() {
                Ok(()) => {}
                Err(e) if e == "remote branch not found" => return Ok(None),
                Err(e) => return Err(e),
            }
            let path = p.key_to_path(&key);
            let meta = match fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => return Ok(None),
            };
            let last_modified = meta
                .modified()
                .ok()
                .map(|t| chrono::DateTime::<chrono::Local>::from(t).to_rfc3339());
            Ok(Some(SyncFileInfo {
                exists: true,
                last_modified,
                size: Some(meta.len() as i64),
            }))
        })
        .await
    }

    async fn test(&self) -> Result<(), String> {
        self.run_blocking("test", Self::TEST_TIMEOUT_SECS, move |p| {
            p.test_remote_connection()
        })
        .await
    }

    async fn delete_prefix(&self, prefix: &str) -> Result<(), String> {
        let prefix = prefix.to_string();
        self.run_blocking("delete-prefix", Self::WRITE_TIMEOUT_SECS, move |p| {
            p.prepare_repo_for_mutation()?;
            let path = p.key_to_path(&prefix);
            if path.exists() {
                if path.is_dir() {
                    fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
                } else {
                    fs::remove_file(&path).map_err(|e| e.to_string())?;
                }
            }
            Ok(())
        })
        .await
    }

    async fn finalize(&self, _message: &str) -> Result<(), String> {
        self.run_blocking("push", Self::WRITE_TIMEOUT_SECS, move |p| {
            p.commit_and_push()
        })
        .await
    }

    async fn check_remote_changed(
        &self,
        _key: &str,
        _known_hash: &str,
    ) -> Result<RemoteCheckResult, String> {
        self.run_blocking("check-remote", Self::TEST_TIMEOUT_SECS, move |p| {
            p.check_remote_hash()
        })
        .await
    }

    fn is_remote(&self) -> bool {
        true
    }

    fn name(&self) -> &'static str {
        "git"
    }
}
