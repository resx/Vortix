use super::*;

pub(super) async fn sync_export(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<Value>>, ApiError> {
    let provider = create_provider(&body).map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let state = get_sync_state(&db).await?;
    let data = collect_sync_data(&db).await?;

    match select_sync_format(&body) {
        SyncFormatSelection::V5 => {
            let (header, envelope) = build_v5_envelope(&state, &data, &body)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
            persist_local_v5_snapshot(&db, &envelope);
            write_v5_remote(&provider, &header, envelope)
                .await
                .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
            let remote_token = read_remote_token(&provider, SYNC_V5_FILENAME).await;
            set_sync_state(&db, header.revision, remote_token).await?;
            Ok(ok_empty())
        }
        SyncFormatSelection::V4 => {
            let (manifest, chunks) = build_manifest(&state, &data, &body)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
            let remote_manifest = read_manifest(&provider).await.ok().flatten();
            let missing = filter_missing_chunks(&chunks, remote_manifest.as_ref());

            upload_chunks(
                provider.clone(),
                missing,
                DEFAULT_MAX_CONCURRENCY,
                SYNC_CHUNK_PREFIX,
            )
            .await
            .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;

            let manifest_bytes = serde_json::to_vec_pretty(&manifest)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            provider
                .write(SYNC_MANIFEST_FILENAME, Bytes::from(manifest_bytes))
                .await
                .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
            let _ = provider.delete(SYNC_V5_FILENAME).await;
            let _ = provider.delete(SYNC_V5_RAW_FILENAME).await;
            let _ = provider.delete(SYNC_V5_LEGACY_FILENAME).await;
            let _ = provider.delete(SYNC_FILENAME).await;
            let _ = provider.delete(SYNC_LEGACY_FILENAME).await;
            provider
                .finalize("vortix sync")
                .await
                .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
            let remote_token = read_remote_token(&provider, SYNC_MANIFEST_FILENAME).await;
            set_sync_state(&db, manifest.sync_meta.revision, remote_token).await?;
            Ok(ok_empty())
        }
        SyncFormatSelection::V3 => {
            let mut data = data;
            let (encryption_type, effective_key) = effective_encryption(&body);
            let mut salt = [0u8; SYNC_SALT_LENGTH];
            rand_core::OsRng.fill_bytes(&mut salt);
            let salt_hex = hex::encode(salt);
            let derived = derive_sync_key(effective_key, &salt);
            encrypt_sync_data(&mut data, &derived)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;

            let data_value = serde_json::to_value(&data)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            let checksum = compute_checksum_value(&data_value)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
            let revision = state.last_sync_revision + 1;
            let now = now_rfc3339();

            let payload = json!({
                "$schema": "vortix-sync",
                "version": 3,
                "deviceId": state.device_id.clone(),
                "exportedAt": now,
                "checksum": checksum,
                "syncMeta": {
                    "revision": revision,
                    "lastSyncDeviceId": state.device_id,
                    "encryptionSalt": salt_hex,
                    "encryptionType": encryption_type,
                },
                "data": data_value,
            });

            let content = serde_json::to_string_pretty(&payload)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            provider
                .write(SYNC_FILENAME, Bytes::from(content))
                .await
                .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
            let _ = provider.delete(SYNC_V5_FILENAME).await;
            let _ = provider.delete(SYNC_V5_RAW_FILENAME).await;
            let _ = provider.delete(SYNC_V5_LEGACY_FILENAME).await;
            let _ = provider.delete(SYNC_MANIFEST_FILENAME).await;
            let _ = provider.delete(SYNC_LEGACY_FILENAME).await;
            let _ = provider.delete_prefix(SYNC_CHUNK_PREFIX).await;
            provider
                .finalize("vortix sync")
                .await
                .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
            let remote_token = read_remote_token(&provider, SYNC_FILENAME).await;
            set_sync_state(&db, revision, remote_token).await?;
            Ok(ok_empty())
        }
    }
}

pub(super) async fn sync_import(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<SyncImportResult>>, ApiError> {
    let provider = create_provider(&body).map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let target_format = select_sync_format(&body);

    if let Some((header, ciphertext)) = read_v5(&provider)
        .await
        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?
    {
        if let Ok(snapshot) = encode_v5_envelope(&header, &ciphertext) {
            persist_local_v5_snapshot(&db, &snapshot);
        }
        let (data, revision) = decode_v5_payload(&body, &header, &ciphertext)
            .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
        let result = apply_sync_payload(&db, data).await?;
        let key = detect_remote_key(&provider, &body).await;
        let remote_token = read_remote_token(&provider, key).await;
        set_sync_state(&db, revision, remote_token).await?;
        return Ok(ok(result));
    }

    if let Some(manifest) = read_manifest(&provider)
        .await
        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?
    {
        let raw = download_chunks(
            provider.clone(),
            &manifest,
            DEFAULT_MAX_CONCURRENCY,
            SYNC_CHUNK_PREFIX,
        )
        .await
        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
        let checksum = compute_checksum_bytes(&raw);
        if checksum != manifest.checksum {
            return Err(err(StatusCode::BAD_REQUEST, "checksum mismatch"));
        }
        let mut data: SyncData = serde_json::from_slice(&raw)
            .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?;
        decrypt_if_needed(
            &mut data,
            &body,
            manifest.sync_meta.encryption_salt,
            manifest.sync_meta.encryption_type,
        )
        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
        let result = apply_sync_payload(&db, data.clone()).await?;
        let mut final_revision = manifest.sync_meta.revision;
        let mut remote_token = read_remote_token(&provider, SYNC_MANIFEST_FILENAME).await;
        if provider.is_remote() && target_format == SyncFormatSelection::V5 {
            let mut migration_state = get_sync_state(&db).await?;
            migration_state.last_sync_revision = manifest.sync_meta.revision;
            migration_state.last_sync_remote_token = remote_token.clone();
            migration_state.local_dirty = 0;
            if let Ok((header, envelope)) = build_v5_envelope(&migration_state, &data, &body) {
                if write_v5_remote(&provider, &header, envelope).await.is_ok() {
                    final_revision = header.revision;
                    remote_token = read_remote_token(&provider, SYNC_V5_FILENAME).await;
                }
            }
        }
        set_sync_state(&db, final_revision, remote_token).await?;
        return Ok(ok(result));
    }

    let (mut data, revision, salt, enc_type) =
        read_legacy(&provider, body.encryption_key.as_deref())
            .await
            .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    decrypt_if_needed(&mut data, &body, salt, enc_type)
        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let result = apply_sync_payload(&db, data.clone()).await?;
    let source_key = detect_remote_key(&provider, &body).await;
    let mut final_revision = revision;
    let mut remote_token = read_remote_token(&provider, source_key).await;
    if provider.is_remote() {
        match target_format {
            SyncFormatSelection::V5 => {
                let mut migration_state = get_sync_state(&db).await?;
                migration_state.last_sync_revision = revision;
                migration_state.last_sync_remote_token = remote_token.clone();
                migration_state.local_dirty = 0;
                if let Ok((header, envelope)) = build_v5_envelope(&migration_state, &data, &body) {
                    if write_v5_remote(&provider, &header, envelope).await.is_ok() {
                        final_revision = header.revision;
                        remote_token = read_remote_token(&provider, SYNC_V5_FILENAME).await;
                    }
                }
            }
            SyncFormatSelection::V4 => {
                let mut migration_state = get_sync_state(&db).await?;
                migration_state.last_sync_revision = revision;
                migration_state.last_sync_remote_token = remote_token.clone();
                migration_state.local_dirty = 0;
                if let Ok((manifest, chunks)) = build_manifest(&migration_state, &data, &body) {
                    upload_chunks(
                        provider.clone(),
                        chunks,
                        DEFAULT_MAX_CONCURRENCY,
                        SYNC_CHUNK_PREFIX,
                    )
                    .await
                    .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
                    let bytes = serde_json::to_vec_pretty(&manifest)
                        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                    provider
                        .write(SYNC_MANIFEST_FILENAME, Bytes::from(bytes))
                        .await
                        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
                    provider
                        .finalize("vortix sync")
                        .await
                        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
                    final_revision = manifest.sync_meta.revision;
                    remote_token = read_remote_token(&provider, SYNC_MANIFEST_FILENAME).await;
                }
            }
            SyncFormatSelection::V3 => {}
        }
    }
    set_sync_state(&db, final_revision, remote_token).await?;
    Ok(ok(result))
}
