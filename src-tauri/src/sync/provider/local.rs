use async_trait::async_trait;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use std::fs;
use std::path::PathBuf;

use super::SyncProvider;
use crate::server::types::SyncFileInfo;

pub struct LocalProvider {
    root: PathBuf,
}

impl LocalProvider {
    pub fn new(path: &str) -> Result<Self, String> {
        if path.trim().is_empty() {
            return Err("syncLocalPath required".to_string());
        }
        Ok(Self {
            root: PathBuf::from(path),
        })
    }

    fn resolve(&self, key: &str) -> PathBuf {
        let clean = key.trim_start_matches('/');
        self.root.join(clean)
    }
}

#[async_trait]
impl SyncProvider for LocalProvider {
    async fn read(&self, key: &str) -> Result<Bytes, String> {
        let path = self.resolve(key);
        let data = fs::read(&path).map_err(|e| e.to_string())?;
        Ok(Bytes::from(data))
    }

    async fn write(&self, key: &str, data: Bytes) -> Result<(), String> {
        let path = self.resolve(key);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&path, &data).map_err(|e| e.to_string())?;
        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<(), String> {
        let path = self.resolve(key);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    async fn stat(&self, key: &str) -> Result<Option<SyncFileInfo>, String> {
        let path = self.resolve(key);
        let meta = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => return Ok(None),
        };
        let last_modified = meta
            .modified()
            .ok()
            .map(|t| DateTime::<Utc>::from(t).to_rfc3339());
        Ok(Some(SyncFileInfo {
            exists: true,
            last_modified,
            size: Some(meta.len() as i64),
        }))
    }

    async fn test(&self) -> Result<(), String> {
        let test_path = self.resolve(".vortix-test");
        if let Some(parent) = test_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&test_path, b"ok").map_err(|e| e.to_string())?;
        let _ = fs::remove_file(&test_path);
        Ok(())
    }

    async fn delete_prefix(&self, prefix: &str) -> Result<(), String> {
        let dir = self.resolve(prefix);
        if dir.exists() {
            if dir.is_dir() {
                fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(&dir).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    fn is_remote(&self) -> bool {
        false
    }
    fn name(&self) -> &'static str {
        "local"
    }
}
