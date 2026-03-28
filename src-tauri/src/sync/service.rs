use axum::http::StatusCode;
use axum::response::Json;
use bytes::Bytes;
use rand_core::RngCore;
use serde_json::{Value, json};
use std::fs;

use crate::db::{Db, repair_runtime_schema};
use crate::server::helpers::{parse_json_value, string_or_default, value_to_json_string};
use crate::server::response::{ApiError, ApiResponse, err, ok, ok_empty};
use crate::server::types::*;
use crate::sync::chunk::chunk_bytes;
use crate::sync::crypto::{
    decrypt_sync_blob, decrypt_sync_data, derive_sync_key, encrypt_sync_blob, encrypt_sync_data,
    sync_kdf_iterations,
};
use crate::sync::diff::filter_missing_chunks;
use crate::sync::format::{
    compute_checksum_bytes, compute_checksum_value, encode_v5_envelope, gzip_compress,
    gzip_decompress, is_v3_json, parse_legacy_payload, parse_manifest_v4, parse_v3_payload,
    parse_v5_envelope, peek_meta_from_manifest, peek_meta_from_v3, peek_meta_from_v5,
};
use crate::sync::provider::{DynProvider, create_provider};
use crate::sync::transfer::{download_chunks, upload_chunks};
use crate::sync::types::{
    SyncEnvelopeHeaderV5, SyncHashAlg, SyncKdfParamsV5, SyncManifestV4, SyncMetaV4, SyncPayloadV5,
};
use crate::time_utils::now_rfc3339;

const SYNC_V5_FILENAME: &str = "vortix.json";
const SYNC_V5_RAW_FILENAME: &str = "vortix"; // 仅用于向后兼容读取/清理，不再写入
const SYNC_V5_LEGACY_FILENAME: &str = "vortix-sync.vxsync";
const SYNC_FILENAME: &str = "vortix-sync.json";
const SYNC_LEGACY_FILENAME: &str = "vortix-sync.dat";
const SYNC_MANIFEST_FILENAME: &str = "vortix-sync.manifest.json";
const SYNC_CHUNK_PREFIX: &str = "chunks/";
const SYNC_BUILTIN_SECRET: &str = "vortix-sync-builtin-v1-2024";
const SYNC_SALT_LENGTH: usize = 16;
const SYNC_BACKUP_VERSION: i64 = 1;

const DEFAULT_CHUNK_SIZE: u64 = 1024 * 1024;
const DEFAULT_MAX_CONCURRENCY: usize = 6;

mod payload_apply;
mod payload_collect;
mod io_codec;
mod io_remote;
mod endpoints_basic;
mod endpoints_check;
mod endpoints_transfer;
mod sync_state_cache;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum SyncFormatSelection {
    V5,
    V4,
    V3,
}

fn looks_like_not_found(error: &str) -> bool {
    let normalized = error.trim().to_lowercase();
    normalized.contains("not found")
        || normalized.contains("404")
        || normalized.contains("no such file")
        || normalized.contains("cannot find the file")
        || normalized.contains("remote branch not found")
}

fn select_sync_format(body: &SyncRequestBody) -> SyncFormatSelection {
    if let Some(version) = body.sync_format_version {
        return if version >= 5 {
            SyncFormatSelection::V5
        } else if version >= 4 {
            SyncFormatSelection::V4
        } else {
            SyncFormatSelection::V3
        };
    }

    if body.sync_use_chunked_manifest == Some(true) {
        return SyncFormatSelection::V4;
    }

    SyncFormatSelection::V5
}

fn default_sync_key_for(format: SyncFormatSelection) -> &'static str {
    match format {
        SyncFormatSelection::V5 => SYNC_V5_FILENAME,
        SyncFormatSelection::V4 => SYNC_MANIFEST_FILENAME,
        SyncFormatSelection::V3 => SYNC_FILENAME,
    }
}

fn effective_encryption(body: &SyncRequestBody) -> (&'static str, &str) {
    match body.encryption_key.as_deref() {
        Some(key) if !key.trim().is_empty() => ("user", key),
        _ => ("builtin", SYNC_BUILTIN_SECRET),
    }
}

fn chunk_size(body: &SyncRequestBody) -> usize {
    body.sync_chunk_size
        .unwrap_or(DEFAULT_CHUNK_SIZE)
        .max(64 * 1024) as usize
}

fn hash_alg(body: &SyncRequestBody) -> SyncHashAlg {
    SyncHashAlg::from_opt(body.sync_hash_algorithm.as_deref())
}

fn compression_enabled(body: &SyncRequestBody) -> bool {
    body.sync_compress_chunks.unwrap_or(true)
}

async fn get_sync_state(db: &Db) -> Result<SyncStateRow, ApiError> {
    if let Some(cached) = sync_state_cache::get().await {
        return Ok(cached);
    }
    let state = sqlx::query_as::<_, SyncStateRow>(
        "SELECT device_id, last_sync_revision, last_sync_at, local_dirty FROM sync_state WHERE id = 1",
    )
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or_else(|| err(StatusCode::INTERNAL_SERVER_ERROR, "sync state missing"))?;
    sync_state_cache::put(state.clone()).await;
    Ok(state)
}

async fn set_sync_state(db: &Db, revision: i64) -> Result<(), ApiError> {
    let now = now_rfc3339();
    sqlx::query("UPDATE sync_state SET last_sync_revision = ?, last_sync_at = ?, local_dirty = 0 WHERE id = 1")
        .bind(revision)
        .bind(now)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if let Ok(Some(state)) = sqlx::query_as::<_, SyncStateRow>(
        "SELECT device_id, last_sync_revision, last_sync_at, local_dirty FROM sync_state WHERE id = 1",
    )
    .fetch_optional(&db.pool)
    .await
    {
        sync_state_cache::put(state).await;
    }
    Ok(())
}

pub fn invalidate_sync_state_cache() {
    sync_state_cache::invalidate_sync_state_cache();
}

async fn collect_sync_data(db: &Db) -> Result<SyncData, ApiError> {
    payload_collect::collect_sync_data(db).await
}

async fn apply_sync_payload(db: &Db, data: SyncData) -> Result<SyncImportResult, ApiError> {
    payload_apply::apply_sync_payload(db, data).await
}

fn build_manifest(
    state: &SyncStateRow,
    data: &SyncData,
    body: &SyncRequestBody,
) -> Result<(SyncManifestV4, Vec<crate::sync::chunk::ChunkData>), String> {
    io_codec::build_manifest(state, data, body)
}

fn build_v5_envelope(
    state: &SyncStateRow,
    data: &SyncData,
    body: &SyncRequestBody,
) -> Result<(SyncEnvelopeHeaderV5, Vec<u8>), String> {
    io_codec::build_v5_envelope(state, data, body)
}

async fn read_manifest(provider: &DynProvider) -> Result<Option<SyncManifestV4>, String> {
    io_remote::read_manifest(provider).await
}

async fn read_v5(
    provider: &DynProvider,
) -> Result<Option<(SyncEnvelopeHeaderV5, Vec<u8>)>, String> {
    io_remote::read_v5(provider).await
}

async fn read_legacy(
    provider: &DynProvider,
    encryption_key: Option<&str>,
) -> Result<(SyncData, i64, Option<String>, Option<String>), String> {
    io_remote::read_legacy(provider, encryption_key).await
}

fn decrypt_if_needed(
    data: &mut SyncData,
    body: &SyncRequestBody,
    encryption_salt: Option<String>,
    encryption_type: Option<String>,
) -> Result<(), String> {
    io_codec::decrypt_if_needed(data, body, encryption_salt, encryption_type)
}

fn decode_v5_payload(
    body: &SyncRequestBody,
    header: &SyncEnvelopeHeaderV5,
    ciphertext: &[u8],
) -> Result<(SyncData, i64), String> {
    io_codec::decode_v5_payload(body, header, ciphertext)
}

async fn write_v5_remote(
    provider: &DynProvider,
    header: &SyncEnvelopeHeaderV5,
    envelope: Vec<u8>,
) -> Result<(), String> {
    io_remote::write_v5_remote(provider, header, envelope).await
}

fn persist_local_v5_snapshot(db: &Db, envelope: &[u8]) {
    io_codec::persist_local_v5_snapshot(db, envelope)
}

async fn detect_remote_key(provider: &DynProvider, body: &SyncRequestBody) -> &'static str {
    io_remote::detect_remote_key(provider, body).await
}

async fn read_remote_meta(provider: &DynProvider) -> Option<SyncRemoteMeta> {
    io_remote::read_remote_meta(provider).await
}

pub async fn sync_test(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<Value>>, ApiError> {
    endpoints_basic::sync_test(db, body).await
}

pub async fn sync_status(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<SyncFileInfo>>, ApiError> {
    endpoints_basic::sync_status(db, body).await
}

pub async fn sync_local_state(db: Db) -> Result<Json<ApiResponse<SyncLocalState>>, ApiError> {
    endpoints_basic::sync_local_state(db).await
}

pub async fn sync_export(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<Value>>, ApiError> {
    endpoints_transfer::sync_export(db, body).await
}

pub async fn sync_import(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<SyncImportResult>>, ApiError> {
    endpoints_transfer::sync_import(db, body).await
}

pub async fn sync_delete_remote(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<Value>>, ApiError> {
    endpoints_basic::sync_delete_remote(db, body).await
}

pub async fn sync_check_push(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<SyncConflictInfo>>, ApiError> {
    endpoints_check::sync_check_push(db, body).await
}

pub async fn sync_check_pull(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<SyncConflictInfo>>, ApiError> {
    endpoints_check::sync_check_pull(db, body).await
}

pub async fn sync_check_remote(
    db: Db,
    body: SyncRequestBody,
) -> Result<Json<ApiResponse<RemoteCheckResult>>, ApiError> {
    endpoints_check::sync_check_remote(db, body).await
}
