use std::fs;

use crate::server::types::RemoteCheckResult;

use super::GitProvider;

impl GitProvider {
    pub(crate) fn remote_head_hash(&self) -> Result<String, String> {
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
        result
    }

    pub(crate) fn check_remote_hash(&self, known_token: &str) -> Result<RemoteCheckResult, String> {
        let remote_hash = self.remote_head_hash()?;
        let has_update =
            !remote_hash.is_empty() && (known_token.is_empty() || remote_hash != known_token);
        Ok(RemoteCheckResult {
            has_update,
            remote_hash,
            local_hash: known_token.to_string(),
        })
    }
}
