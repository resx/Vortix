use super::*;

pub(super) async fn sync_test(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<Value>>, ApiError> {
    let provider = create_provider(&body).map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let _ = db;
    provider
        .test()
        .await
        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    Ok(ok_empty())
}

pub(super) async fn sync_status(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<SyncFileInfo>>, ApiError> {
    let _ = db;
    let provider = create_provider(&body).map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let not_found = SyncFileInfo {
        exists: false,
        last_modified: None,
        size: None,
    };

    match read_v5(&provider).await {
        Ok(Some(_)) => {
            let stat = match provider.stat(SYNC_V5_FILENAME).await {
                Ok(Some(s)) => Some(s),
                Ok(None) => provider
                    .stat(SYNC_V5_LEGACY_FILENAME)
                    .await
                    .map_err(|e| err(StatusCode::BAD_REQUEST, e))?,
                Err(_) => provider
                    .stat(SYNC_V5_LEGACY_FILENAME)
                    .await
                    .map_err(|e| err(StatusCode::BAD_REQUEST, e))?,
            };
            return Ok(ok(stat.unwrap_or(SyncFileInfo {
                exists: true,
                last_modified: None,
                size: None,
            })));
        }
        Ok(None) => {}
        Err(e) if provider.name() == "git" || looks_like_not_found(&e) => return Ok(ok(not_found)),
        Err(e) => return Err(err(StatusCode::BAD_REQUEST, e)),
    }

    match read_manifest(&provider).await {
        Ok(Some(manifest)) => {
            let stat = provider
                .stat(SYNC_MANIFEST_FILENAME)
                .await
                .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
            return Ok(ok(SyncFileInfo {
                exists: true,
                last_modified: stat.and_then(|s| s.last_modified),
                size: Some(manifest.data.total_size as i64),
            }));
        }
        Ok(None) => {}
        Err(e) if provider.name() == "git" || looks_like_not_found(&e) => return Ok(ok(not_found)),
        Err(e) => return Err(err(StatusCode::BAD_REQUEST, e)),
    }

    let info = match provider.stat(SYNC_FILENAME).await {
        Ok(value) => value,
        Err(e) => match provider.read(SYNC_FILENAME).await {
            Ok(bytes) => Some(SyncFileInfo {
                exists: true,
                last_modified: None,
                size: Some(bytes.len() as i64),
            }),
            Err(read_err) if looks_like_not_found(&e) || looks_like_not_found(&read_err) => None,
            Err(_) => return Err(err(StatusCode::BAD_REQUEST, e)),
        },
    };
    if let Some(info) = info {
        return Ok(ok(info));
    }

    let info = match provider.stat(SYNC_LEGACY_FILENAME).await {
        Ok(value) => value,
        Err(e) => match provider.read(SYNC_LEGACY_FILENAME).await {
            Ok(bytes) => Some(SyncFileInfo {
                exists: true,
                last_modified: None,
                size: Some(bytes.len() as i64),
            }),
            Err(read_err) if looks_like_not_found(&e) || looks_like_not_found(&read_err) => None,
            Err(_) => return Err(err(StatusCode::BAD_REQUEST, e)),
        },
    };
    Ok(ok(info.unwrap_or(not_found)))
}

pub(super) async fn sync_local_state(db: Db) -> Result<Json<ApiResponse<SyncLocalState>>, ApiError> {
    let state = get_sync_state(&db).await?;
    Ok(ok(SyncLocalState {
        local_dirty: state.local_dirty != 0,
        last_sync_revision: state.last_sync_revision,
        last_sync_at: state.last_sync_at,
    }))
}

pub(super) async fn sync_delete_remote(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<Value>>, ApiError> {
    let _ = db;
    let provider = create_provider(&body).map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let _ = provider.delete(SYNC_V5_FILENAME).await;
    let _ = provider.delete(SYNC_V5_RAW_FILENAME).await;
    let _ = provider.delete(SYNC_V5_LEGACY_FILENAME).await;
    let _ = provider.delete(SYNC_FILENAME).await;
    let _ = provider.delete(SYNC_LEGACY_FILENAME).await;
    let _ = provider.delete(SYNC_MANIFEST_FILENAME).await;
    let _ = provider.delete_prefix(SYNC_CHUNK_PREFIX).await;
    provider
        .finalize("vortix sync")
        .await
        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    Ok(ok_empty())
}
