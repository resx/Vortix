use std::fs;

use crate::server::types::RemoteCheckResult;

use super::GitProvider;

impl GitProvider {
    pub(crate) fn check_remote_hash(&self) -> Result<RemoteCheckResult, String> {
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
            Ok(stdout.split_whitespace().next().unwrap_or("").to_string())
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
}
