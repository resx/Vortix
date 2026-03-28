use async_trait::async_trait;
use bytes::Bytes;
use chrono::{DateTime, Local};
use futures::TryStreamExt;
use moka::future::Cache;
use opendal::services::{S3, Webdav};
use opendal::Operator;
use std::time::SystemTime;
use url::Url;

use super::SyncProvider;
use crate::server::types::{SyncFileInfo, SyncRequestBody};

pub struct OpenDalProvider {
    op: Operator,
    name: &'static str,
    stat_cache: Cache<String, SyncFileInfo>,
}

impl OpenDalProvider {
    fn ensure_tls_verify_enabled(tls_verify: bool, provider: &str) -> Result<(), String> {
        if tls_verify {
            Ok(())
        } else {
            Err(format!(
                "syncTlsVerify=false 已禁用：{} 同步必须开启证书校验",
                provider
            ))
        }
    }

    fn ensure_https_endpoint(endpoint: &str, label: &str, required: bool) -> Result<(), String> {
        let trimmed = endpoint.trim();
        if trimmed.is_empty() {
            if required {
                return Err(format!("{} 不能为空", label));
            }
            return Ok(());
        }

        let parsed = Url::parse(trimmed)
            .map_err(|_| format!("{} 非法，请使用 https:// 开头的完整地址", label))?;
        if parsed.scheme() != "https" {
            return Err(format!("{} 必须使用 https://，禁止明文传输", label));
        }
        Ok(())
    }

    pub fn from_webdav(body: &SyncRequestBody) -> Result<Self, String> {
        let endpoint = body
            .sync_webdav_endpoint
            .as_ref()
            .ok_or("syncWebdavEndpoint required")?;
        let username = body.sync_webdav_username.clone().unwrap_or_default();
        let password = body.sync_webdav_password.clone().unwrap_or_default();
        let root = body
            .sync_webdav_path
            .clone()
            .unwrap_or_else(|| "vortix".to_string());
        let tls_verify = body.sync_tls_verify.unwrap_or(true);

        Self::ensure_tls_verify_enabled(tls_verify, "WebDAV")?;
        Self::ensure_https_endpoint(endpoint, "syncWebdavEndpoint", true)?;

        let builder = Webdav::default()
            .endpoint(endpoint)
            .username(&username)
            .password(&password)
            .root(&root);
        let op = Operator::new(builder).map_err(|e| e.to_string())?.finish();

        Ok(Self {
            op,
            name: "webdav",
            stat_cache: Cache::new(1024),
        })
    }

    pub fn from_s3(body: &SyncRequestBody) -> Result<Self, String> {
        let endpoint = body.sync_s3_endpoint.clone().unwrap_or_default();
        let bucket = body.sync_s3_bucket.as_ref().ok_or("syncS3Bucket required")?;
        let access_key = body
            .sync_s3_access_key
            .as_ref()
            .ok_or("syncS3AccessKey required")?;
        let secret_key = body
            .sync_s3_secret_key
            .as_ref()
            .ok_or("syncS3SecretKey required")?;
        let region = body
            .sync_s3_region
            .clone()
            .unwrap_or_else(|| "us-east-1".to_string());
        let root = body
            .sync_s3_path
            .clone()
            .unwrap_or_else(|| "vortix".to_string());
        let tls_verify = body.sync_tls_verify.unwrap_or(true);

        Self::ensure_tls_verify_enabled(tls_verify, "S3")?;
        Self::ensure_https_endpoint(&endpoint, "syncS3Endpoint", false)?;

        let builder = S3::default()
            .bucket(bucket)
            .region(&region)
            .access_key_id(access_key)
            .secret_access_key(secret_key)
            .root(&root);

        let builder = if !endpoint.trim().is_empty() {
            builder.endpoint(&endpoint)
        } else {
            builder
        };

        let builder = if body.sync_s3_style.as_deref() == Some("virtual-hosted") {
            builder.enable_virtual_host_style()
        } else {
            builder
        };

        let op = Operator::new(builder).map_err(|e| e.to_string())?.finish();

        Ok(Self {
            op,
            name: "s3",
            stat_cache: Cache::new(1024),
        })
    }

    fn key(&self, key: &str) -> String {
        key.trim_start_matches('/').to_string()
    }

    fn metadata_token(meta: &opendal::Metadata) -> Option<String> {
        meta.version()
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
            .or_else(|| {
                meta.etag()
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
            })
            .or_else(|| {
                meta.last_modified()
                    .map(|t| DateTime::<Local>::from(SystemTime::from(t)).to_rfc3339())
            })
    }
}

#[async_trait]
impl SyncProvider for OpenDalProvider {
    async fn read(&self, key: &str) -> Result<Bytes, String> {
        let key = self.key(key);
        let data = self.op.read(&key).await.map_err(|e| e.to_string())?;
        Ok(data.to_bytes())
    }

    async fn write(&self, key: &str, data: Bytes) -> Result<(), String> {
        let key = self.key(key);
        self.op.write(&key, data).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<(), String> {
        let key = self.key(key);
        let _ = self.op.delete(&key).await;
        Ok(())
    }

    async fn stat(&self, key: &str) -> Result<Option<SyncFileInfo>, String> {
        let key = self.key(key);
        if let Some(info) = self.stat_cache.get(&key).await {
            return Ok(Some(info));
        }

        let meta = match self.op.stat(&key).await {
            Ok(m) => m,
            Err(_) => return Ok(None),
        };

        let last_modified = meta
            .last_modified()
            .map(|t| DateTime::<Local>::from(SystemTime::from(t)).to_rfc3339());

        let info = SyncFileInfo {
            exists: true,
            last_modified,
            size: Some(meta.content_length() as i64),
        };

        self.stat_cache.insert(key, info.clone()).await;
        Ok(Some(info))
    }

    async fn read_remote_token(&self, key: &str) -> Result<Option<String>, String> {
        let key = self.key(key);
        let meta = match self.op.stat(&key).await {
            Ok(m) => m,
            Err(_) => return Ok(None),
        };
        Ok(Self::metadata_token(&meta))
    }

    async fn test(&self) -> Result<(), String> {
        let key = self.key(".vortix-test");
        self.op
            .write(&key, Bytes::from_static(b"ok"))
            .await
            .map_err(|e| e.to_string())?;
        let _ = self.op.delete(&key).await;
        Ok(())
    }

    async fn delete_prefix(&self, prefix: &str) -> Result<(), String> {
        let prefix = self.key(prefix);
        let mut lister = self.op.lister(&prefix).await.map_err(|e| e.to_string())?;
        while let Some(entry) = lister.try_next().await.map_err(|e| e.to_string())? {
            let path = entry.path().to_string();
            let _ = self.op.delete(&path).await;
        }
        Ok(())
    }

    fn is_remote(&self) -> bool {
        true
    }

    fn name(&self) -> &'static str {
        self.name
    }
}
