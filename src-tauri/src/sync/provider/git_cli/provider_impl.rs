use async_trait::async_trait;
use bytes::Bytes;
use std::fs;

use crate::server::types::{RemoteCheckResult, SyncFileInfo};

use super::super::SyncProvider;
use super::GitProvider;

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

    async fn read_remote_token(&self, _key: &str) -> Result<Option<String>, String> {
        self.run_blocking("read-remote-token", Self::TEST_TIMEOUT_SECS, move |p| {
            p.remote_head_hash().map(Some)
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
        known_token: &str,
    ) -> Result<RemoteCheckResult, String> {
        let known_token = known_token.to_string();
        self.run_blocking("check-remote", Self::TEST_TIMEOUT_SECS, move |p| {
            p.check_remote_hash(&known_token)
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
