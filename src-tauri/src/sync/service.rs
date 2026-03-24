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
    sqlx::query_as::<_, SyncStateRow>(
        "SELECT device_id, last_sync_revision, last_sync_at, local_dirty FROM sync_state WHERE id = 1",
    )
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or_else(|| err(StatusCode::INTERNAL_SERVER_ERROR, "sync state missing"))
}

async fn set_sync_state(db: &Db, revision: i64) -> Result<(), ApiError> {
    let now = now_rfc3339();
    sqlx::query("UPDATE sync_state SET last_sync_revision = ?, last_sync_at = ?, local_dirty = 0 WHERE id = 1")
        .bind(revision)
        .bind(now)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(())
}

async fn collect_sync_data(db: &Db) -> Result<SyncData, ApiError> {
    let folders: Vec<SyncFolder> = sqlx::query_as(
        "SELECT id, name, parent_id, sort_order, created_at, updated_at FROM folders",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let shortcuts: Vec<SyncShortcut> = sqlx::query_as(
        "SELECT id, name, command, remark, group_name, sort_order, created_at, updated_at FROM shortcuts",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let shortcut_groups: Vec<SyncShortcutGroup> = sqlx::query_as(
        "SELECT id, name, sort_order, created_at, updated_at FROM shortcut_groups",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let conn_rows: Vec<ConnectionRow> = sqlx::query_as("SELECT * FROM connections")
        .fetch_all(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut connections = Vec::with_capacity(conn_rows.len());
    for row in conn_rows {
        let password = match row.encrypted_password {
            Some(enc) if !enc.is_empty() => Some(
                db.crypto
                    .decrypt(&enc)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            ),
            _ => None,
        };
        let private_key = match row.encrypted_private_key {
            Some(enc) if !enc.is_empty() => Some(
                db.crypto
                    .decrypt(&enc)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            ),
            _ => None,
        };
        let passphrase = match row.encrypted_passphrase {
            Some(enc) if !enc.is_empty() => Some(
                db.crypto
                    .decrypt(&enc)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            ),
            _ => None,
        };
        let proxy_password = if row.proxy_password.is_empty() {
            None
        } else {
            Some(
                db.crypto
                    .decrypt(&row.proxy_password)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            )
        };
        connections.push(SyncConnection {
            id: row.id,
            folder_id: row.folder_id,
            name: row.name,
            protocol: row.protocol,
            host: row.host,
            port: row.port,
            username: row.username,
            auth_method: row.auth_method,
            password,
            private_key,
            passphrase,
            sort_order: row.sort_order,
            remark: row.remark,
            color_tag: row.color_tag,
            environment: row.environment,
            auth_type: row.auth_type,
            proxy_type: row.proxy_type,
            proxy_host: row.proxy_host,
            proxy_port: row.proxy_port,
            proxy_username: row.proxy_username,
            proxy_password,
            proxy_timeout: row.proxy_timeout,
            jump_server_id: row.jump_server_id,
            preset_id: row.preset_id,
            private_key_id: row.private_key_id,
            jump_key_id: row.jump_key_id,
            tunnels: parse_json_value(&row.tunnels, Value::String(row.tunnels.clone())),
            env_vars: parse_json_value(&row.env_vars, Value::String(row.env_vars.clone())),
            advanced: parse_json_value(&row.advanced, Value::String(row.advanced.clone())),
            created_at: row.created_at,
            updated_at: row.updated_at,
        });
    }

    let key_rows: Vec<SshKeyRawRow> = sqlx::query_as(
        "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut ssh_keys = Vec::with_capacity(key_rows.len());
    for row in key_rows {
        let private_key = db
            .crypto
            .decrypt(&row.encrypted_private_key)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        let passphrase = match row.encrypted_passphrase {
            Some(enc) => Some(
                db.crypto
                    .decrypt(&enc)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            ),
            None => None,
        };
        ssh_keys.push(SyncSshKey {
            id: row.id,
            name: row.name,
            key_type: row.key_type,
            private_key,
            public_key: row.public_key,
            passphrase,
            certificate: row.certificate,
            remark: Some(row.remark),
            description: Some(row.description),
            created_at: row.created_at,
        });
    }

    let settings_rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut settings = serde_json::Map::new();
    for (key, value) in settings_rows {
        let parsed = serde_json::from_str::<Value>(&value).unwrap_or(Value::String(value));
        settings.insert(key, parsed);
    }

    let preset_rows: Vec<PresetRow> = sqlx::query_as(
        "SELECT id, name, username, encrypted_password, remark, created_at, updated_at FROM presets",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut presets = Vec::with_capacity(preset_rows.len());
    for row in preset_rows {
        let password = db
            .crypto
            .decrypt(&row.encrypted_password)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        presets.push(SyncPreset {
            id: row.id,
            name: row.name,
            username: row.username,
            password,
            remark: row.remark,
            created_at: row.created_at,
            updated_at: row.updated_at,
        });
    }

    let theme_rows: Vec<(
        String,
        String,
        String,
        i64,
        String,
        String,
        String,
        Option<String>,
        String,
        String,
    )> = sqlx::query_as(
        "SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut themes = Vec::with_capacity(theme_rows.len());
    for (id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at) in
        theme_rows
    {
        themes.push(SyncTheme {
            id,
            name,
            mode,
            version,
            author,
            terminal: serde_json::from_str(&terminal).unwrap_or(Value::String(terminal)),
            highlights: serde_json::from_str(&highlights).unwrap_or(Value::String(highlights)),
            ui: ui.and_then(|raw| serde_json::from_str(&raw).ok()),
            created_at,
            updated_at,
        });
    }

    Ok(SyncData {
        folders,
        connections,
        shortcuts,
        shortcut_groups,
        ssh_keys,
        settings,
        presets,
        themes,
    })
}

async fn apply_sync_payload(db: &Db, data: SyncData) -> Result<SyncImportResult, ApiError> {
    repair_runtime_schema(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    for table in [
        "folders",
        "connections",
        "shortcuts",
        "shortcut_groups",
        "ssh_keys",
        "settings",
        "presets",
        "themes",
    ] {
        sqlx::query(&format!("DELETE FROM {}", table))
            .execute(&mut *tx)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    let mut result = SyncImportResult {
        folders: 0,
        connections: 0,
        shortcuts: 0,
        ssh_keys: 0,
        settings: 0,
        presets: 0,
        themes: 0,
    };

    for folder in data.folders {
        sqlx::query("INSERT OR REPLACE INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(folder.id)
            .bind(folder.name)
            .bind(folder.parent_id)
            .bind(folder.sort_order)
            .bind(folder.created_at)
            .bind(folder.updated_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        result.folders += 1;
    }
    for shortcut in data.shortcuts {
        sqlx::query("INSERT OR REPLACE INTO shortcuts (id, name, command, remark, group_name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(shortcut.id)
            .bind(shortcut.name)
            .bind(shortcut.command)
            .bind(shortcut.remark)
            .bind(shortcut.group_name)
            .bind(shortcut.sort_order)
            .bind(shortcut.created_at)
            .bind(shortcut.updated_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        result.shortcuts += 1;
    }
    for group in data.shortcut_groups {
        sqlx::query(
            "INSERT OR REPLACE INTO shortcut_groups (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(group.id)
        .bind(group.name)
        .bind(group.sort_order)
        .bind(group.created_at)
        .bind(group.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO shortcut_groups (id, name, sort_order, created_at, updated_at)
         SELECT lower(hex(randomblob(16))), trim(group_name), 0, ?, ?
         FROM shortcuts
         WHERE trim(group_name) <> ''",
    )
    .bind(now_rfc3339())
    .bind(now_rfc3339())
    .execute(&mut *tx)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    for conn in data.connections {
        let encrypted_password = match conn.password.as_deref() {
            Some(p) if !p.is_empty() => Some(
                db.crypto
                    .encrypt(p)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            ),
            _ => None,
        };
        let encrypted_private_key = match conn.private_key.as_deref() {
            Some(p) if !p.is_empty() => Some(
                db.crypto
                    .encrypt(p)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            ),
            _ => None,
        };
        let encrypted_passphrase = match conn.passphrase.as_deref() {
            Some(p) if !p.is_empty() => Some(
                db.crypto
                    .encrypt(p)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            ),
            _ => None,
        };
        let proxy_password = match conn.proxy_password.as_deref() {
            Some(p) if !p.is_empty() => db
                .crypto
                .encrypt(p)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            _ => String::new(),
        };
        let environment = string_or_default(conn.environment, "?");
        let auth_type = string_or_default(conn.auth_type, "password");
        let proxy_type = string_or_default(conn.proxy_type, "disabled");
        let proxy_host = string_or_default(conn.proxy_host, "127.0.0.1");
        let proxy_port = if conn.proxy_port <= 0 {
            7890
        } else {
            conn.proxy_port
        };
        let proxy_timeout = if conn.proxy_timeout <= 0 {
            5
        } else {
            conn.proxy_timeout
        };
        let port = if conn.port <= 0 { 22 } else { conn.port };
        let protocol = string_or_default(conn.protocol, "ssh");
        let auth_method = string_or_default(conn.auth_method, "password");
        let tunnels = value_to_json_string(&conn.tunnels, "[]");
        let env_vars = value_to_json_string(&conn.env_vars, "[]");
        let advanced = value_to_json_string(&conn.advanced, "{}");

        sqlx::query(
            "INSERT OR REPLACE INTO connections (id, folder_id, name, protocol, host, port, username, auth_method, encrypted_password, encrypted_private_key, sort_order, remark, color_tag, environment, auth_type, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password, proxy_timeout, jump_server_id, preset_id, private_key_id, jump_key_id, encrypted_passphrase, tunnels, env_vars, advanced, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(conn.id)
        .bind(conn.folder_id)
        .bind(conn.name)
        .bind(protocol)
        .bind(conn.host)
        .bind(port)
        .bind(conn.username)
        .bind(auth_method)
        .bind(encrypted_password)
        .bind(encrypted_private_key)
        .bind(conn.sort_order)
        .bind(conn.remark)
        .bind(conn.color_tag)
        .bind(environment)
        .bind(auth_type)
        .bind(proxy_type)
        .bind(proxy_host)
        .bind(proxy_port)
        .bind(conn.proxy_username)
        .bind(proxy_password)
        .bind(proxy_timeout)
        .bind(conn.jump_server_id)
        .bind(conn.preset_id)
        .bind(conn.private_key_id)
        .bind(conn.jump_key_id)
        .bind(encrypted_passphrase)
        .bind(tunnels)
        .bind(env_vars)
        .bind(advanced)
        .bind(conn.created_at)
        .bind(conn.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        result.connections += 1;
    }
    for key in data.ssh_keys {
        let encrypted_private_key = db
            .crypto
            .encrypt(&key.private_key)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        let encrypted_passphrase = match key.passphrase.as_deref() {
            Some(p) if !p.is_empty() => Some(
                db.crypto
                    .encrypt(p)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            ),
            _ => None,
        };
        let has_passphrase = if encrypted_passphrase.is_some() { 1 } else { 0 };
        sqlx::query(
            "INSERT OR REPLACE INTO ssh_keys (id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(key.id)
        .bind(key.name)
        .bind(key.key_type)
        .bind(key.public_key)
        .bind(has_passphrase)
        .bind(encrypted_private_key)
        .bind(encrypted_passphrase)
        .bind(key.certificate)
        .bind(key.remark.unwrap_or_default())
        .bind(key.description.unwrap_or_default())
        .bind(key.created_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        result.ssh_keys += 1;
    }
    for (key, value) in data.settings {
        let serialized = serde_json::to_string(&value)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
            .bind(key)
            .bind(serialized)
            .execute(&mut *tx)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        result.settings += 1;
    }
    for preset in data.presets {
        let encrypted_password = db
            .crypto
            .encrypt(&preset.password)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        sqlx::query(
            "INSERT OR REPLACE INTO presets (id, name, username, encrypted_password, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(preset.id)
        .bind(preset.name)
        .bind(preset.username)
        .bind(encrypted_password)
        .bind(preset.remark)
        .bind(preset.created_at)
        .bind(preset.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        result.presets += 1;
    }
    for theme in data.themes {
        let terminal = serde_json::to_string(&theme.terminal)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        let highlights = serde_json::to_string(&theme.highlights)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        let ui = theme
            .ui
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        sqlx::query(
            "INSERT OR REPLACE INTO themes (id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(theme.id)
        .bind(theme.name)
        .bind(theme.mode)
        .bind(theme.version)
        .bind(theme.author)
        .bind(terminal)
        .bind(highlights)
        .bind(ui)
        .bind(theme.created_at)
        .bind(theme.updated_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        result.themes += 1;
    }
    tx.commit()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(result)
}

fn build_manifest(
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

fn build_v5_envelope(
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

async fn read_manifest(provider: &DynProvider) -> Result<Option<SyncManifestV4>, String> {
    if provider.stat(SYNC_MANIFEST_FILENAME).await?.is_none() {
        return Ok(None);
    }
    let bytes = provider.read(SYNC_MANIFEST_FILENAME).await?;
    let manifest = parse_manifest_v4(&bytes)?;
    Ok(Some(manifest))
}

async fn read_v5(
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

async fn read_legacy(
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

fn decrypt_if_needed(
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

fn decode_v5_payload(
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

async fn write_v5_remote(
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

fn persist_local_v5_snapshot(db: &Db, envelope: &[u8]) {
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

async fn detect_remote_key(provider: &DynProvider, body: &SyncRequestBody) -> &'static str {
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

async fn read_remote_meta(provider: &DynProvider) -> Option<SyncRemoteMeta> {
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

pub async fn sync_test(
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

pub async fn sync_status(
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

pub async fn sync_local_state(db: Db) -> Result<Json<ApiResponse<SyncLocalState>>, ApiError> {
    let state = get_sync_state(&db).await?;
    Ok(ok(SyncLocalState {
        local_dirty: state.local_dirty != 0,
        last_sync_revision: state.last_sync_revision,
        last_sync_at: state.last_sync_at,
    }))
}

pub async fn sync_export(
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
            set_sync_state(&db, header.revision).await?;
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
            set_sync_state(&db, manifest.sync_meta.revision).await?;
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
            set_sync_state(&db, revision).await?;
            Ok(ok_empty())
        }
    }
}

pub async fn sync_import(
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
        set_sync_state(&db, revision).await?;
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
        set_sync_state(&db, manifest.sync_meta.revision).await?;

        if provider.is_remote() && target_format == SyncFormatSelection::V5 {
            let state = get_sync_state(&db).await?;
            if let Ok((header, envelope)) = build_v5_envelope(&state, &data, &body) {
                let _ = write_v5_remote(&provider, &header, envelope).await;
            }
        }

        return Ok(ok(result));
    }

    let (mut data, revision, salt, enc_type) =
        read_legacy(&provider, body.encryption_key.as_deref())
            .await
            .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    decrypt_if_needed(&mut data, &body, salt, enc_type)
        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let result = apply_sync_payload(&db, data.clone()).await?;
    set_sync_state(&db, revision).await?;

    if provider.is_remote() {
        match target_format {
            SyncFormatSelection::V5 => {
                let state = get_sync_state(&db).await?;
                if let Ok((header, envelope)) = build_v5_envelope(&state, &data, &body) {
                    let _ = write_v5_remote(&provider, &header, envelope).await;
                }
            }
            SyncFormatSelection::V4 => {
                let state = get_sync_state(&db).await?;
                if let Ok((manifest, chunks)) = build_manifest(&state, &data, &body) {
                    let _ = upload_chunks(
                        provider.clone(),
                        chunks,
                        DEFAULT_MAX_CONCURRENCY,
                        SYNC_CHUNK_PREFIX,
                    )
                    .await;
                    if let Ok(bytes) = serde_json::to_vec_pretty(&manifest) {
                        let _ = provider
                            .write(SYNC_MANIFEST_FILENAME, Bytes::from(bytes))
                            .await;
                        let _ = provider.finalize("vortix sync").await;
                    }
                }
            }
            SyncFormatSelection::V3 => {}
        }
    }

    Ok(ok(result))
}

pub async fn sync_delete_remote(
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

pub async fn sync_check_push(
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

pub async fn sync_check_pull(
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

pub async fn sync_check_remote(
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
