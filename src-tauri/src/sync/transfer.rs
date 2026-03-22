use bytes::BytesMut;
use futures::stream::{FuturesUnordered, StreamExt};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::time::{Duration, sleep};

use crate::sync::chunk::{ChunkData, decompress_chunk};
use crate::sync::provider::DynProvider;
use crate::sync::types::SyncManifestV4;

async fn retry_async<F, Fut, T>(mut f: F) -> Result<T, String>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, String>>,
{
    let mut delay = 200u64;
    let mut attempt = 0u32;
    loop {
        match f().await {
            Ok(v) => return Ok(v),
            Err(e) => {
                attempt += 1;
                if attempt >= 5 {
                    return Err(e);
                }
                let jitter = (attempt as u64 * 37) % 100;
                sleep(Duration::from_millis(delay + jitter)).await;
                delay = (delay * 2).min(4000);
            }
        }
    }
}

pub async fn upload_chunks(
    provider: DynProvider,
    chunks: Vec<ChunkData>,
    max_concurrency: usize,
    prefix: &str,
) -> Result<(), String> {
    if chunks.is_empty() {
        return Ok(());
    }
    let sem = Arc::new(Semaphore::new(max_concurrency.max(1)));
    let mut tasks = FuturesUnordered::new();

    for chunk in chunks {
        let permit = sem
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| e.to_string())?;
        let provider = provider.clone();
        let key = format!("{}{}", prefix, chunk.hash);
        tasks.push(tokio::spawn(async move {
            let _permit = permit;
            retry_async(|| {
                let provider = provider.clone();
                let data = chunk.bytes.clone();
                let key = key.clone();
                async move { provider.write(&key, data).await }
            })
            .await
        }));
    }

    while let Some(res) = tasks.next().await {
        match res {
            Ok(Ok(())) => {}
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}

pub async fn download_chunks(
    provider: DynProvider,
    manifest: &SyncManifestV4,
    max_concurrency: usize,
    prefix: &str,
) -> Result<Vec<u8>, String> {
    let total_size = manifest.data.total_size as usize;
    let mut buffer = BytesMut::with_capacity(total_size);
    buffer.resize(total_size, 0u8);

    let sem = Arc::new(Semaphore::new(max_concurrency.max(1)));
    let mut tasks = FuturesUnordered::new();

    let mut offset = 0usize;
    for chunk in &manifest.data.chunks {
        let start = offset;
        let end = start + chunk.size as usize;
        offset = end;

        let permit = sem
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| e.to_string())?;
        let provider = provider.clone();
        let key = format!("{}{}", prefix, chunk.hash);
        let compressed = chunk.compressed;
        tasks.push(tokio::spawn(async move {
            let _permit = permit;
            let data = retry_async(|| {
                let provider = provider.clone();
                let key = key.clone();
                async move { provider.read(&key).await }
            })
            .await?;

            let raw: Vec<u8> = if compressed {
                decompress_chunk(&data).map_err(|e| e)?
            } else {
                data.to_vec()
            };

            Ok::<(usize, Vec<u8>), String>((start, raw))
        }));
    }

    while let Some(res) = tasks.next().await {
        let (start, raw) = match res {
            Ok(Ok(v)) => v,
            Ok(Err(e)) => return Err(e),
            Err(e) => return Err(e.to_string()),
        };
        let end = start + raw.len();
        buffer[start..end].copy_from_slice(&raw);
    }

    Ok(buffer.to_vec())
}
