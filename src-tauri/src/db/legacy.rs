/* ── 旧 JSON 数据导入（仅首次启动） ── */

use anyhow::{Context, Result};
use chrono::Utc;
use serde::Deserialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::fs;
use std::path::Path;
use rand_core::RngCore;

#[derive(Default)]
pub struct ImportSummary {
    pub folders: usize,
    pub connections: usize,
    pub shortcuts: usize,
    pub ssh_keys: usize,
    pub presets: usize,
    pub history: usize,
    pub logs: usize,
    pub themes: usize,
    pub settings: usize,
}

#[derive(Deserialize)]
struct FolderRow {
    id: String,
    name: String,
    parent_id: Option<String>,
    sort_order: Option<i64>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct ConnectionRow {
    id: String,
    folder_id: Option<String>,
    name: String,
    protocol: String,
    host: String,
    port: i64,
    username: String,
    auth_method: String,
    encrypted_password: Option<String>,
    encrypted_private_key: Option<String>,
    sort_order: Option<i64>,
    remark: Option<String>,
    color_tag: Option<String>,
    environment: Option<String>,
    auth_type: Option<String>,
    proxy_type: Option<String>,
    proxy_host: Option<String>,
    proxy_port: Option<i64>,
    proxy_username: Option<String>,
    proxy_password: Option<String>,
    proxy_timeout: Option<i64>,
    jump_server_id: Option<String>,
    preset_id: Option<String>,
    private_key_id: Option<String>,
    jump_key_id: Option<String>,
    encrypted_passphrase: Option<String>,
    tunnels: Option<String>,
    env_vars: Option<String>,
    advanced: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct ShortcutRow {
    id: String,
    name: String,
    command: String,
    remark: Option<String>,
    sort_order: Option<i64>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct SshKeyRow {
    id: String,
    name: String,
    key_type: String,
    public_key: Option<String>,
    has_passphrase: bool,
    encrypted_private_key: String,
    encrypted_passphrase: Option<String>,
    certificate: Option<String>,
    remark: Option<String>,
    description: Option<String>,
    created_at: String,
}

#[derive(Deserialize)]
struct PresetRow {
    id: String,
    name: String,
    username: String,
    encrypted_password: String,
    remark: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct ThemeRow {
    id: String,
    name: String,
    mode: String,
    version: Option<i64>,
    author: Option<String>,
    terminal: Value,
    highlights: Value,
    ui: Option<Value>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct HistoryRow {
    id: i64,
    connection_id: String,
    command: String,
    executed_at: String,
}

#[derive(Deserialize)]
struct LogRow {
    id: i64,
    connection_id: String,
    event: String,
    message: Option<String>,
    duration_ms: Option<i64>,
    created_at: String,
}

#[derive(Deserialize)]
struct SyncState {
    deviceId: String,
    lastSyncRevision: i64,
    lastSyncAt: Option<String>,
    localDirty: bool,
}

pub fn has_legacy_data(legacy_dir: &Path) -> bool {
    let config = legacy_dir.join("config");
    let logs = legacy_dir.join("logs");
    config.exists() || logs.exists() || legacy_dir.join("sync-state.json").exists()
}

pub async fn import_all(legacy_dir: &Path, pool: &SqlitePool) -> Result<ImportSummary> {
    let mut summary = ImportSummary::default();

    let config_dir = legacy_dir.join("config");
    let logs_dir = legacy_dir.join("logs");

    let mut tx = pool.begin().await?;

    if let Some(rows) = read_json_array::<FolderRow>(&config_dir.join("folders.json"))? {
        for row in rows {
            sqlx::query(
                "INSERT OR REPLACE INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(row.id)
            .bind(row.name)
            .bind(row.parent_id)
            .bind(row.sort_order.unwrap_or(0))
            .bind(row.created_at)
            .bind(row.updated_at)
            .execute(&mut *tx)
            .await?;
            summary.folders += 1;
        }
    }

    if let Some(rows) = read_json_array::<PresetRow>(&config_dir.join("presets.json"))? {
        for row in rows {
            sqlx::query(
                "INSERT OR REPLACE INTO presets (id, name, username, encrypted_password, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(row.id)
            .bind(row.name)
            .bind(row.username)
            .bind(row.encrypted_password)
            .bind(row.remark.unwrap_or_default())
            .bind(row.created_at)
            .bind(row.updated_at)
            .execute(&mut *tx)
            .await?;
            summary.presets += 1;
        }
    }

    if let Some(rows) = read_json_array::<SshKeyRow>(&config_dir.join("ssh-keys.json"))? {
        for row in rows {
            sqlx::query(
                "INSERT OR REPLACE INTO ssh_keys (id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(row.id)
            .bind(row.name)
            .bind(row.key_type)
            .bind(row.public_key)
            .bind(if row.has_passphrase { 1 } else { 0 })
            .bind(row.encrypted_private_key)
            .bind(row.encrypted_passphrase)
            .bind(row.certificate)
            .bind(row.remark.unwrap_or_default())
            .bind(row.description.unwrap_or_default())
            .bind(row.created_at)
            .execute(&mut *tx)
            .await?;
            summary.ssh_keys += 1;
        }
    }

    if let Some(rows) = read_json_array::<ConnectionRow>(&config_dir.join("connections.json"))? {
        for row in rows {
            sqlx::query(
                "INSERT OR REPLACE INTO connections (id, folder_id, name, protocol, host, port, username, auth_method, encrypted_password, encrypted_private_key, sort_order, remark, color_tag, environment, auth_type, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password, proxy_timeout, jump_server_id, preset_id, private_key_id, jump_key_id, encrypted_passphrase, tunnels, env_vars, advanced, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(row.id)
            .bind(row.folder_id)
            .bind(row.name)
            .bind(row.protocol)
            .bind(row.host)
            .bind(row.port)
            .bind(row.username)
            .bind(row.auth_method)
            .bind(row.encrypted_password)
            .bind(row.encrypted_private_key)
            .bind(row.sort_order.unwrap_or(0))
            .bind(row.remark.unwrap_or_default())
            .bind(row.color_tag)
            .bind(row.environment.unwrap_or_else(|| "无".to_string()))
            .bind(row.auth_type.unwrap_or_else(|| "password".to_string()))
            .bind(row.proxy_type.unwrap_or_else(|| "关闭".to_string()))
            .bind(row.proxy_host.unwrap_or_else(|| "127.0.0.1".to_string()))
            .bind(row.proxy_port.unwrap_or(7890))
            .bind(row.proxy_username.unwrap_or_default())
            .bind(row.proxy_password.unwrap_or_default())
            .bind(row.proxy_timeout.unwrap_or(5))
            .bind(row.jump_server_id)
            .bind(row.preset_id)
            .bind(row.private_key_id)
            .bind(row.jump_key_id)
            .bind(row.encrypted_passphrase)
            .bind(row.tunnels.unwrap_or_else(|| "[]".to_string()))
            .bind(row.env_vars.unwrap_or_else(|| "[]".to_string()))
            .bind(row.advanced.unwrap_or_else(|| "{}".to_string()))
            .bind(row.created_at)
            .bind(row.updated_at)
            .execute(&mut *tx)
            .await?;
            summary.connections += 1;
        }
    }

    if let Some(rows) = read_json_array::<ShortcutRow>(&config_dir.join("shortcuts.json"))? {
        for row in rows {
            sqlx::query(
                "INSERT OR REPLACE INTO shortcuts (id, name, command, remark, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(row.id)
            .bind(row.name)
            .bind(row.command)
            .bind(row.remark.unwrap_or_default())
            .bind(row.sort_order.unwrap_or(0))
            .bind(row.created_at)
            .bind(row.updated_at)
            .execute(&mut *tx)
            .await?;
            summary.shortcuts += 1;
        }
    }

    if let Some(settings) = read_json_object(&config_dir.join("settings.json"))? {
        for (key, value) in settings {
            let serialized = serde_json::to_string(&value)?;
            sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
                .bind(key)
                .bind(serialized)
                .execute(&mut *tx)
                .await?;
            summary.settings += 1;
        }
    }

    if let Some(rows) = read_json_array::<ThemeRow>(&config_dir.join("themes.json"))? {
        for row in rows {
            let terminal = serde_json::to_string(&row.terminal)?;
            let highlights = serde_json::to_string(&row.highlights)?;
            let ui = row.ui.as_ref().map(serde_json::to_string).transpose()?;
            sqlx::query(
                "INSERT OR REPLACE INTO themes (id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(row.id)
            .bind(row.name)
            .bind(row.mode)
            .bind(row.version.unwrap_or(1))
            .bind(row.author.unwrap_or_default())
            .bind(terminal)
            .bind(highlights)
            .bind(ui)
            .bind(row.created_at)
            .bind(row.updated_at)
            .execute(&mut *tx)
            .await?;
            summary.themes += 1;
        }
    }

    if let Some(rows) = read_jsonl::<HistoryRow>(&logs_dir.join("command-history.jsonl"))? {
        for row in rows {
            sqlx::query(
                "INSERT OR REPLACE INTO history (id, connection_id, command, executed_at) VALUES (?, ?, ?, ?)",
            )
            .bind(row.id)
            .bind(row.connection_id)
            .bind(row.command)
            .bind(row.executed_at)
            .execute(&mut *tx)
            .await?;
            summary.history += 1;
        }
    }

    if let Some(rows) = read_jsonl::<LogRow>(&logs_dir.join("connection-logs.jsonl"))? {
        for row in rows {
            sqlx::query(
                "INSERT OR REPLACE INTO logs (id, connection_id, event, message, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(row.id)
            .bind(row.connection_id)
            .bind(row.event)
            .bind(row.message.unwrap_or_default())
            .bind(row.duration_ms)
            .bind(row.created_at)
            .execute(&mut *tx)
            .await?;
            summary.logs += 1;
        }
    }

    if let Some(state) = read_json::<SyncState>(&legacy_dir.join("sync-state.json"))? {
        sqlx::query(
            "INSERT OR REPLACE INTO sync_state (id, device_id, last_sync_revision, last_sync_at, local_dirty) VALUES (1, ?, ?, ?, ?)",
        )
        .bind(state.deviceId)
        .bind(state.lastSyncRevision)
        .bind(state.lastSyncAt)
        .bind(if state.localDirty { 1 } else { 0 })
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(summary)
}

pub fn archive_legacy_data(legacy_dir: &Path) -> Result<()> {
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let archive_root = legacy_dir.join("legacy").join(timestamp);
    fs::create_dir_all(&archive_root)?;

    move_if_exists(&legacy_dir.join("config"), &archive_root.join("config"))?;
    move_if_exists(&legacy_dir.join("logs"), &archive_root.join("logs"))?;
    move_if_exists(&legacy_dir.join("sync-state.json"), &archive_root.join("sync-state.json"))?;
    move_if_exists(&legacy_dir.join("encryption.key"), &archive_root.join("encryption.key"))?;

    Ok(())
}

pub fn generate_device_id() -> String {
    let mut bytes = [0u8; 4];
    rand_core::OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn read_json_array<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Option<Vec<T>>> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).with_context(|| format!("读取文件失败: {}", path.display()))?;
    let data = serde_json::from_str::<Vec<T>>(&content)
        .with_context(|| format!("解析 JSON 失败: {}", path.display()))?;
    Ok(Some(data))
}

fn read_json_object(path: &Path) -> Result<Option<serde_json::Map<String, Value>>> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).with_context(|| format!("读取文件失败: {}", path.display()))?;
    let data = serde_json::from_str::<serde_json::Map<String, Value>>(&content)
        .with_context(|| format!("解析 JSON 失败: {}", path.display()))?;
    Ok(Some(data))
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Option<T>> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).with_context(|| format!("读取文件失败: {}", path.display()))?;
    let data = serde_json::from_str::<T>(&content)
        .with_context(|| format!("解析 JSON 失败: {}", path.display()))?;
    Ok(Some(data))
}

fn read_jsonl<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<Option<Vec<T>>> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).with_context(|| format!("读取文件失败: {}", path.display()))?;
    let mut rows = Vec::new();
    for (idx, line) in content.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let row = serde_json::from_str::<T>(line)
            .with_context(|| format!("解析 JSONL 失败: {}:{}", path.display(), idx + 1))?;
        rows.push(row);
    }
    Ok(Some(rows))
}

fn move_if_exists(src: &Path, dest: &Path) -> Result<()> {
    if !src.exists() {
        return Ok(());
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(src, dest)?;
    Ok(())
}
