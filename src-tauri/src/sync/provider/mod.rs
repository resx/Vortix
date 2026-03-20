use async_trait::async_trait;
use bytes::Bytes;
use std::sync::Arc;

use crate::server::types::{SyncFileInfo, SyncRequestBody, RemoteCheckResult};

pub mod local;
pub mod opendal;
pub mod git_cli;

pub type DynProvider = Arc<dyn SyncProvider>;

#[async_trait]
pub trait SyncProvider: Send + Sync {
    async fn read(&self, key: &str) -> Result<Bytes, String>;
    async fn write(&self, key: &str, data: Bytes) -> Result<(), String>;
    async fn delete(&self, key: &str) -> Result<(), String>;
    async fn stat(&self, key: &str) -> Result<Option<SyncFileInfo>, String>;
    async fn test(&self) -> Result<(), String>;
    async fn delete_prefix(&self, _prefix: &str) -> Result<(), String> { Ok(()) }
    async fn finalize(&self, _message: &str) -> Result<(), String> { Ok(()) }
    /// 轻量级远端变更检测：不下载数据，仅比较标识符判断远端是否有更新。
    /// 默认实现使用 stat() 对比文件修改时间，Git provider 覆盖为 ls-remote 对比 hash。
    async fn check_remote_changed(&self, key: &str, known_hash: &str) -> Result<RemoteCheckResult, String> {
        let info = self.stat(key).await?;
        let remote_hash = info.as_ref()
            .and_then(|i| i.last_modified.clone())
            .unwrap_or_default();
        let has_update = !remote_hash.is_empty() && remote_hash != known_hash;
        Ok(RemoteCheckResult { has_update, remote_hash, local_hash: known_hash.to_string() })
    }
    fn is_remote(&self) -> bool;
    fn name(&self) -> &'static str;
}

pub fn create_provider(body: &SyncRequestBody) -> Result<DynProvider, String> {
    match body.repo_source.as_str() {
        "local" => {
            let path = body.sync_local_path.as_ref().ok_or("syncLocalPath required")?;
            Ok(Arc::new(local::LocalProvider::new(path)?))
        }
        "git" => {
            Ok(Arc::new(git_cli::GitProvider::new(body)?))
        }
        "webdav" => {
            Ok(Arc::new(opendal::OpenDalProvider::from_webdav(body)?))
        }
        "s3" => {
            Ok(Arc::new(opendal::OpenDalProvider::from_s3(body)?))
        }
        other => Err(format!("unknown repoSource: {}", other)),
    }
}
