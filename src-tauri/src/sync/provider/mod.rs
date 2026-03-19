use async_trait::async_trait;
use bytes::Bytes;
use std::sync::Arc;

use crate::server::types::{SyncFileInfo, SyncRequestBody};

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
