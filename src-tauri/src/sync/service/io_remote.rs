use super::*;

pub(super) async fn read_manifest(provider: &DynProvider) -> Result<Option<SyncManifestV4>, String> {
    if provider.stat(SYNC_MANIFEST_FILENAME).await?.is_none() {
        return Ok(None);
    }
    let bytes = provider.read(SYNC_MANIFEST_FILENAME).await?;
    let manifest = parse_manifest_v4(&bytes)?;
    Ok(Some(manifest))
}

pub(super) async fn read_v5(
    provider: &DynProvider,
) -> Result<Option<(SyncEnvelopeHeaderV5, Vec<u8>)>, String> {
    if provider.stat(SYNC_V5_FILENAME).await?.is_some() {
        let bytes = provider.read(SYNC_V5_FILENAME).await?;
        let parsed = match gzip_decompress(&bytes) {
            Ok(raw) => parse_v5_envelope(&raw)?,
            Err(_) => parse_v5_envelope(&bytes)?,
        };
        return Ok(Some(parsed));
    }
    if provider.stat(SYNC_V5_RAW_FILENAME).await?.is_some() {
        let bytes = provider.read(SYNC_V5_RAW_FILENAME).await?;
        let parsed = parse_v5_envelope(&bytes)?;
        return Ok(Some(parsed));
    }
    if provider.stat(SYNC_V5_LEGACY_FILENAME).await?.is_some() {
        let bytes = provider.read(SYNC_V5_LEGACY_FILENAME).await?;
        let parsed = parse_v5_envelope(&bytes)?;
        return Ok(Some(parsed));
    }
    Ok(None)
}

pub(super) async fn read_legacy(
    provider: &DynProvider,
    encryption_key: Option<&str>,
) -> Result<(SyncData, i64, Option<String>, Option<String>), String> {
    let data = if let Ok(bytes) = provider.read(SYNC_FILENAME).await {
        if is_v3_json(&bytes) {
            let payload = parse_v3_payload(&bytes)?;
            let data: SyncData = serde_json::from_value(payload.data).map_err(|e| e.to_string())?;
            return Ok((
                data,
                payload.sync_meta.revision,
                payload.sync_meta.encryption_salt,
                payload.sync_meta.encryption_type,
            ));
        }
        bytes
    } else {
        provider.read(SYNC_LEGACY_FILENAME).await?
    };
    let (data, rev) = parse_legacy_payload(&data, encryption_key)?;
    Ok((data, rev, None, None))
}

pub(super) async fn write_v5_remote(
    provider: &DynProvider,
    header: &SyncEnvelopeHeaderV5,
    envelope: Vec<u8>,
) -> Result<(), String> {
    let packaged = gzip_compress(&envelope)?;
    provider
        .write(SYNC_V5_FILENAME, Bytes::from(packaged))
        .await?;
    let _ = provider.delete(SYNC_V5_RAW_FILENAME).await;
    let _ = provider.delete(SYNC_FILENAME).await;
    let _ = provider.delete(SYNC_V5_LEGACY_FILENAME).await;
    let _ = provider.delete(SYNC_LEGACY_FILENAME).await;
    let _ = provider.delete(SYNC_MANIFEST_FILENAME).await;
    let _ = provider.delete_prefix(SYNC_CHUNK_PREFIX).await;
    provider
        .finalize(&format!(
            "vortix sync v{} r{}",
            header.version, header.revision
        ))
        .await?;
    Ok(())
}

pub(super) async fn detect_remote_key(provider: &DynProvider, body: &SyncRequestBody) -> &'static str {
    for key in [
        SYNC_V5_FILENAME,
        SYNC_V5_LEGACY_FILENAME,
        SYNC_MANIFEST_FILENAME,
        SYNC_FILENAME,
        SYNC_LEGACY_FILENAME,
    ] {
        if provider.stat(key).await.ok().flatten().is_some() {
            return key;
        }
    }
    default_sync_key_for(select_sync_format(body))
}

pub(super) async fn read_remote_meta(provider: &DynProvider) -> Option<SyncRemoteMeta> {
    if let Ok(Some((header, _))) = read_v5(provider).await {
        return peek_meta_from_v5(&header);
    }
    if let Ok(Some(manifest)) = read_manifest(provider).await {
        return peek_meta_from_manifest(&manifest);
    }
    if let Ok(bytes) = provider.read(SYNC_FILENAME).await {
        if let Ok(payload) = parse_v3_payload(&bytes) {
            return peek_meta_from_v3(&payload);
        }
    }
    if provider.read(SYNC_LEGACY_FILENAME).await.is_ok() {
        return Some(SyncRemoteMeta {
            revision: 0,
            device_id: String::new(),
            exported_at: String::new(),
        });
    }
    None
}
