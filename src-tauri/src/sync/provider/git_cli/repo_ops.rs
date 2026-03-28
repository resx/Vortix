use std::fs;

use crate::time_utils::now_rfc3339;

use super::GitProvider;

impl GitProvider {
    pub(crate) fn test_remote_connection(&self) -> Result<(), String> {
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

    pub(crate) fn remote_branch_exists(&self) -> Result<bool, String> {
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

    pub(crate) fn clone_repo(&self) -> Result<(), String> {
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

    pub(crate) fn init_empty_repo(&self) -> Result<(), String> {
        self.remove_workdir()?;
        fs::create_dir_all(&self.work_dir).map_err(|e| e.to_string())?;
        let output = self
            .git_cmd(None)
            .args(["init", "-b", &self.branch])
            .output()
            .map_err(|e| format!("git init 失败: {}", e))?;
        Self::run_output(output, "init")?;
        self.configure_repo()?;
        let output = self
            .git_cmd(None)
            .args(["remote", "add", "origin", &self.url])
            .output()
            .map_err(|e| e.to_string())?;
        Self::run_output(output, "remote add")?;
        Ok(())
    }

    pub(crate) fn configure_repo(&self) -> Result<(), String> {
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

        let output = self
            .git_cmd(None)
            .args(["remote", "set-url", "origin", &self.url])
            .output()
            .map_err(|e| e.to_string())?;
        if !output.status.success() {
            let _ = self
                .git_cmd(None)
                .args(["remote", "add", "origin", &self.url])
                .output();
        }
        Ok(())
    }

    pub(crate) fn fetch_and_reset(&self) -> Result<(), String> {
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

    pub(crate) fn has_pending_changes(&self) -> Result<bool, String> {
        let output = self
            .git_cmd(None)
            .args(["status", "--porcelain"])
            .output()
            .map_err(|e| e.to_string())?;
        let stdout = Self::run_output(output, "status")?;
        Ok(!stdout.trim().is_empty())
    }

    pub(crate) fn remove_workdir(&self) -> Result<(), String> {
        if self.work_dir.exists() {
            fs::remove_dir_all(&self.work_dir).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub(crate) fn ensure_repo_for_read(&self) -> Result<(), String> {
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

    pub(crate) fn prepare_repo_for_mutation(&self) -> Result<(), String> {
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

    pub(crate) fn cleanup_old_files(&self) -> Result<(), String> {
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

    pub(crate) fn commit_and_push(&self) -> Result<(), String> {
        self.prepare_repo_for_mutation()?;
        self.cleanup_old_files()?;
        let output = self
            .git_cmd(None)
            .args(["add", "-A"])
            .output()
            .map_err(|e| e.to_string())?;
        Self::run_output(output, "add")?;
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
}
