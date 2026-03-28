use super::*;

pub(super) async fn sync_check_push(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<SyncConflictInfo>>, ApiError> {
    let provider = create_provider(&body).map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let state = get_sync_state(&db).await?;
    let meta = read_remote_meta(&provider).await;

    if let Some(meta) = meta {
        if meta.revision > state.last_sync_revision {
            return Ok(ok(SyncConflictInfo {
                has_conflict: true,
                reason: Some("remote_ahead".to_string()),
                local_revision: state.last_sync_revision,
                remote_revision: meta.revision,
                remote_device_id: Some(meta.device_id),
                remote_exported_at: Some(meta.exported_at),
            }));
        }
        return Ok(ok(SyncConflictInfo {
            has_conflict: false,
            reason: None,
            local_revision: state.last_sync_revision,
            remote_revision: meta.revision,
            remote_device_id: None,
            remote_exported_at: None,
        }));
    }
    Ok(ok(SyncConflictInfo {
        has_conflict: false,
        reason: None,
        local_revision: state.last_sync_revision,
        remote_revision: 0,
        remote_device_id: None,
        remote_exported_at: None,
    }))
}

pub(super) async fn sync_check_pull(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<SyncConflictInfo>>, ApiError> {
    let provider = create_provider(&body).map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let state = get_sync_state(&db).await?;
    let meta = read_remote_meta(&provider).await;

    if let Some(meta) = meta {
        if state.local_dirty != 0 && meta.revision > state.last_sync_revision {
            return Ok(ok(SyncConflictInfo {
                has_conflict: true,
                reason: Some("local_dirty".to_string()),
                local_revision: state.last_sync_revision,
                remote_revision: meta.revision,
                remote_device_id: Some(meta.device_id),
                remote_exported_at: Some(meta.exported_at),
            }));
        }
        return Ok(ok(SyncConflictInfo {
            has_conflict: false,
            reason: None,
            local_revision: state.last_sync_revision,
            remote_revision: meta.revision,
            remote_device_id: None,
            remote_exported_at: None,
        }));
    }
    Ok(ok(SyncConflictInfo {
        has_conflict: false,
        reason: None,
        local_revision: state.last_sync_revision,
        remote_revision: 0,
        remote_device_id: None,
        remote_exported_at: None,
    }))
}

pub(super) async fn sync_check_remote(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<RemoteCheckResult>>, ApiError> {
    let provider = create_provider(&body).map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let state = get_sync_state(&db).await?;
    let known_hash = state.last_sync_at.unwrap_or_default();
    let key = detect_remote_key(&provider, &body).await;
    let result = provider
        .check_remote_changed(key, &known_hash)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(ok(result))
}
