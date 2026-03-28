use super::*;

pub(super) fn build_manifest(
    state: &SyncStateRow,
    data: &SyncData,
    body: &SyncRequestBody,
) -> Result<(SyncManifestV4, Vec<crate::sync::chunk::ChunkData>), String> {
    let mut data = data.clone();
    let (encryption_type, effective_key) = effective_encryption(body);
    let mut salt = [0u8; SYNC_SALT_LENGTH];
    rand_core::OsRng.fill_bytes(&mut salt);
    let salt_hex = hex::encode(salt);
    let derived = derive_sync_key(effective_key, &salt);
    encrypt_sync_data(&mut data, &derived)?;

    let data_bytes = serde_json::to_vec(&data).map_err(|e| e.to_string())?;
    let checksum = compute_checksum_bytes(&data_bytes);
    let chunked = chunk_bytes(
        &data_bytes,
        chunk_size(body),
        hash_alg(body),
        compression_enabled(body),
    );

    let manifest = SyncManifestV4 {
        schema: "vortix-sync".to_string(),
        version: 4,
        device_id: state.device_id.clone(),
        exported_at: now_rfc3339(),
        checksum,
        sync_meta: SyncMetaV4 {
            revision: state.last_sync_revision + 1,
            last_sync_device_id: state.device_id.clone(),
            encryption_salt: Some(salt_hex),
            encryption_type: Some(encryption_type.to_string()),
            hash_alg: hash_alg(body).as_str().to_string(),
            chunk_size: chunk_size(body) as u64,
            compression: if compression_enabled(body) {
                "zlib".to_string()
            } else {
                "none".to_string()
            },
        },
        data: chunked.manifest,
    };

    Ok((manifest, chunked.chunks))
}

pub(super) fn build_v5_envelope(
    state: &SyncStateRow,
    data: &SyncData,
    body: &SyncRequestBody,
) -> Result<(SyncEnvelopeHeaderV5, Vec<u8>), String> {
    let revision = state.last_sync_revision + 1;
    let exported_at = now_rfc3339();
    let payload = SyncPayloadV5 {
        backup_version: SYNC_BACKUP_VERSION,
        device_id: state.device_id.clone(),
        exported_at: exported_at.clone(),
        revision,
        data: data.clone(),
    };
    let payload_bytes = serde_json::to_vec(&payload).map_err(|e| e.to_string())?;
    let compressed = gzip_compress(&payload_bytes)?;

    let (encryption_type, effective_key) = effective_encryption(body);
    let mut salt = [0u8; SYNC_SALT_LENGTH];
    rand_core::OsRng.fill_bytes(&mut salt);
    let derived = derive_sync_key(effective_key, &salt);
    let (iv, ciphertext) = encrypt_sync_blob(&compressed, &derived)?;

    let header = SyncEnvelopeHeaderV5 {
        schema: "vortix-sync".to_string(),
        version: 5,
        backup_version: SYNC_BACKUP_VERSION,
        device_id: state.device_id.clone(),
        exported_at,
        revision,
        compression: "gzip".to_string(),
        cipher: "aes-256-gcm".to_string(),
        kdf: "pbkdf2-sha256".to_string(),
        kdf_params: SyncKdfParamsV5 {
            iterations: sync_kdf_iterations(),
            hash: "sha256".to_string(),
        },
        encryption_salt: hex::encode(salt),
        encryption_type: encryption_type.to_string(),
        iv: hex::encode(iv),
        payload_hash: compute_checksum_bytes(&compressed),
    };

    let envelope = encode_v5_envelope(&header, &ciphertext)?;
    Ok((header, envelope))
}

pub(super) fn decrypt_if_needed(
    data: &mut SyncData,
    body: &SyncRequestBody,
    encryption_salt: Option<String>,
    encryption_type: Option<String>,
) -> Result<(), String> {
    if let Some(salt_hex) = encryption_salt.filter(|s| !s.is_empty()) {
        let salt = hex::decode(salt_hex).map_err(|_| "invalid salt".to_string())?;
        let (effective_key, is_user) = match encryption_type.as_deref() {
            Some("user") => (
                body.encryption_key
                    .as_deref()
                    .ok_or("missing encryption key")?,
                true,
            ),
            Some("builtin") => (SYNC_BUILTIN_SECRET, false),
            _ => (
                body.encryption_key
                    .as_deref()
                    .ok_or("missing encryption key")?,
                true,
            ),
        };
        let derived = derive_sync_key(effective_key, &salt);
        if decrypt_sync_data(data, &derived).is_err() {
            let msg = if is_user {
                "invalid encryption key"
            } else {
                "builtin key mismatch"
            };
            return Err(msg.to_string());
        }
    }
    Ok(())
}

pub(super) fn decode_v5_payload(
    body: &SyncRequestBody,
    header: &SyncEnvelopeHeaderV5,
    ciphertext: &[u8],
) -> Result<(SyncData, i64), String> {
    if header.schema != "vortix-sync" || header.version != 5 {
        return Err("invalid v5 header".to_string());
    }
    if header.compression != "gzip" {
        return Err(format!("unsupported compression: {}", header.compression));
    }
    if header.cipher != "aes-256-gcm" {
        return Err(format!("unsupported cipher: {}", header.cipher));
    }
    if header.kdf != "pbkdf2-sha256" {
        return Err(format!("unsupported kdf: {}", header.kdf));
    }

    let salt = hex::decode(&header.encryption_salt).map_err(|_| "invalid v5 salt".to_string())?;
    let iv = hex::decode(&header.iv).map_err(|_| "invalid v5 iv".to_string())?;
    let (effective_key, is_user) = match header.encryption_type.as_str() {
        "user" => (
            body.encryption_key
                .as_deref()
                .ok_or("missing encryption key")?,
            true,
        ),
        "builtin" => (SYNC_BUILTIN_SECRET, false),
        _ => {
            return Err(format!(
                "unsupported encryption type: {}",
                header.encryption_type
            ));
        }
    };
    let derived = derive_sync_key(effective_key, &salt);
    let compressed = decrypt_sync_blob(ciphertext, &derived, &iv).map_err(|_| {
        if is_user {
            "invalid encryption key".to_string()
        } else {
            "builtin key mismatch".to_string()
        }
    })?;
    let payload_hash = compute_checksum_bytes(&compressed);
    if payload_hash != header.payload_hash {
        return Err("v5 payload hash mismatch".to_string());
    }
    let payload_bytes = gzip_decompress(&compressed)?;
    let payload: SyncPayloadV5 =
        serde_json::from_slice(&payload_bytes).map_err(|e| format!("invalid v5 payload: {}", e))?;
    Ok((payload.data, payload.revision))
}

pub(super) fn persist_local_v5_snapshot(db: &Db, envelope: &[u8]) {
    let json_path = db.paths.data_dir.join("vortix.json");
    if let Some(parent) = json_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    match gzip_compress(envelope) {
        Ok(packaged) => {
            if let Err(e) = fs::write(&json_path, packaged) {
                tracing::warn!("[Vortix] failed to write local sync packaged snapshot: {}", e);
            }
        }
        Err(e) => {
            tracing::warn!("[Vortix] failed to package local sync snapshot: {}", e);
        }
    }
    let raw_path = db.paths.data_dir.join(SYNC_V5_RAW_FILENAME);
    if raw_path.exists() {
        let _ = fs::remove_file(raw_path);
    }
}
