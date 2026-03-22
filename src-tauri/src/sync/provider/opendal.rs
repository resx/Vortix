use async_trait::async_trait;
use bytes::Bytes;
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use moka::future::Cache;
use opendal::Operator;
use opendal::layers::HttpClientLayer;
use opendal::raw::HttpClient;
use opendal::services::{S3, Webdav};
use std::time::SystemTime;
use tracing::warn;

use super::SyncProvider;
use crate::server::types::{SyncFileInfo, SyncRequestBody};

pub struct OpenDalProvider {
    op: Operator,
    name: &'static str,
    stat_cache: Cache<String, SyncFileInfo>,
}

impl OpenDalProvider {
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

        // opendal 0.55: builder 方法均为 take-self 模式，必须链式调用
        let builder = Webdav::default()
            .endpoint(endpoint)
            .username(&username)
            .password(&password)
            .root(&root);
        let op_builder = Operator::new(builder).map_err(|e| e.to_string())?;
        // OperatorBuilder<impl Access> 与 OperatorBuilder<HttpClientAccessor<impl Access>> 类型不同，
        // 不能用 mut 赋值切换，必须在两个分支各自 .finish() 统一为 Operator
        let op = if !tls_verify {
            warn!(
                "syncTlsVerify=false: WebDAV TLS 证书校验已关闭，这会降低安全性。仅建议在自签名证书或测试环境使用。"
            );
            let client = reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .map_err(|e| e.to_string())?;
            op_builder
                .layer(HttpClientLayer::new(HttpClient::with(client)))
                .finish()
        } else {
            op_builder.finish()
        };
        Ok(Self {
            op,
            name: "webdav",
            stat_cache: Cache::new(1024),
        })
    }

    pub fn from_s3(body: &SyncRequestBody) -> Result<Self, String> {
        let endpoint = body.sync_s3_endpoint.clone().unwrap_or_default();
        let bucket = body
            .sync_s3_bucket
            .as_ref()
            .ok_or("syncS3Bucket required")?;
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

        // opendal 0.55: builder 方法均为 take-self 模式，必须链式调用
        let builder = S3::default()
            .bucket(bucket)
            .region(&region)
            .access_key_id(access_key)
            .secret_access_key(secret_key)
            .root(&root);
        // 条件配置也需要链式处理
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
        let op_builder = Operator::new(builder).map_err(|e| e.to_string())?;
        let op = if !tls_verify {
            warn!(
                "syncTlsVerify=false: S3 TLS 证书校验已关闭，这会降低安全性。仅建议在自签名证书或测试环境使用。"
            );
            let client = reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
                .map_err(|e| e.to_string())?;
            op_builder
                .layer(HttpClientLayer::new(HttpClient::with(client)))
                .finish()
        } else {
            op_builder.finish()
        };
        Ok(Self {
            op,
            name: "s3",
            stat_cache: Cache::new(1024),
        })
    }

    fn key(&self, key: &str) -> String {
        let clean = key.trim_start_matches('/');
        clean.to_string()
    }
}

#[async_trait]
impl SyncProvider for OpenDalProvider {
    async fn read(&self, key: &str) -> Result<Bytes, String> {
        let key = self.key(key);
        let data = self.op.read(&key).await.map_err(|e| e.to_string())?;
        // opendal 0.55: read() 返回 Buffer，需 .to_bytes() 转换为 bytes::Bytes
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
        // moka::future::Cache::get() 返回 impl Future，需要 .await
        if let Some(info) = self.stat_cache.get(&key).await {
            return Ok(Some(info));
        }
        let meta = match self.op.stat(&key).await {
            Ok(m) => m,
            Err(_) => return Ok(None),
        };
        // opendal 0.55: Timestamp 实现 From<Timestamp> for SystemTime，再转 chrono
        let last_modified = meta
            .last_modified()
            .map(|t| DateTime::<Utc>::from(SystemTime::from(t)).to_rfc3339());
        let info = SyncFileInfo {
            exists: true,
            last_modified,
            // opendal 0.55: content_length() 返回 u64（非 Option）
            size: Some(meta.content_length() as i64),
        };
        self.stat_cache.insert(key, info.clone()).await;
        Ok(Some(info))
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
