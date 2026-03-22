#![allow(dead_code)]

/* ── SQLite -> JSON 备份导出 ── */

use anyhow::{Context, Result};
use chrono::Utc;
use serde::Serialize;
use serde_json::{Map, Value};
use sqlx::{FromRow, SqlitePool};
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct BackupPayload {
    schema_version: i32,
    exported_at: String,
    data: BackupData,
}

#[derive(Serialize)]
struct BackupData {
    folders: Vec<FolderRow>,
    connections: Vec<ConnectionRow>,
    settings: Map<String, Value>,
    history: Vec<HistoryRow>,
    logs: Vec<LogRow>,
    shortcuts: Vec<ShortcutRow>,
    ssh_keys: Vec<SshKeyRow>,
    presets: Vec<PresetRow>,
    themes: Vec<ThemeRow>,
}

#[derive(Serialize, FromRow)]
struct FolderRow {
    id: String,
    name: String,
    parent_id: Option<String>,
    sort_order: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, FromRow)]
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
    sort_order: i64,
    remark: String,
    color_tag: Option<String>,
    environment: String,
    auth_type: String,
    proxy_type: String,
    proxy_host: String,
    proxy_port: i64,
    proxy_username: String,
    proxy_password: String,
    proxy_timeout: i64,
    jump_server_id: Option<String>,
    preset_id: Option<String>,
    private_key_id: Option<String>,
    jump_key_id: Option<String>,
    encrypted_passphrase: Option<String>,
    tunnels: String,
    env_vars: String,
    advanced: String,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, FromRow)]
struct ShortcutRow {
    id: String,
    name: String,
    command: String,
    remark: String,
    sort_order: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, FromRow)]
struct SshKeyRow {
    id: String,
    name: String,
    key_type: String,
    public_key: Option<String>,
    has_passphrase: i64,
    encrypted_private_key: String,
    encrypted_passphrase: Option<String>,
    certificate: Option<String>,
    remark: String,
    description: String,
    created_at: String,
}

#[derive(Serialize, FromRow)]
struct PresetRow {
    id: String,
    name: String,
    username: String,
    encrypted_password: String,
    remark: String,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct ThemeRow {
    id: String,
    name: String,
    mode: String,
    version: i64,
    author: String,
    terminal: Value,
    highlights: Value,
    ui: Option<Value>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, FromRow)]
struct HistoryRow {
    id: i64,
    connection_id: String,
    command: String,
    executed_at: String,
}

#[derive(Serialize, FromRow)]
struct LogRow {
    id: i64,
    connection_id: String,
    event: String,
    message: String,
    duration_ms: Option<i64>,
    created_at: String,
}

pub async fn export_to_json(pool: &SqlitePool, path: &Path) -> Result<()> {
    let folders: Vec<FolderRow> = sqlx::query_as(
        "SELECT id, name, parent_id, sort_order, created_at, updated_at FROM folders",
    )
    .fetch_all(pool)
    .await?;

    let connections: Vec<ConnectionRow> = sqlx::query_as(
        "SELECT id, folder_id, name, protocol, host, port, username, auth_method, encrypted_password, encrypted_private_key, sort_order, remark, color_tag, environment, auth_type, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password, proxy_timeout, jump_server_id, preset_id, private_key_id, jump_key_id, encrypted_passphrase, tunnels, env_vars, advanced, created_at, updated_at FROM connections",
    )
    .fetch_all(pool)
    .await?;

    let settings_rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(pool)
        .await?;
    let mut settings = Map::new();
    for (key, value) in settings_rows {
        let parsed = serde_json::from_str::<Value>(&value).unwrap_or(Value::String(value));
        settings.insert(key, parsed);
    }

    let history: Vec<HistoryRow> =
        sqlx::query_as("SELECT id, connection_id, command, executed_at FROM history")
            .fetch_all(pool)
            .await?;

    let logs: Vec<LogRow> = sqlx::query_as(
        "SELECT id, connection_id, event, message, duration_ms, created_at FROM logs",
    )
    .fetch_all(pool)
    .await?;

    let shortcuts: Vec<ShortcutRow> = sqlx::query_as(
        "SELECT id, name, command, remark, sort_order, created_at, updated_at FROM shortcuts",
    )
    .fetch_all(pool)
    .await?;

    let ssh_keys: Vec<SshKeyRow> = sqlx::query_as("SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys")
        .fetch_all(pool)
        .await?;

    let presets: Vec<PresetRow> = sqlx::query_as("SELECT id, name, username, encrypted_password, remark, created_at, updated_at FROM presets")
        .fetch_all(pool)
        .await?;

    let theme_rows: Vec<(String, String, String, i64, String, String, String, Option<String>, String, String)> =
        sqlx::query_as("SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes")
            .fetch_all(pool)
            .await?;
    let mut themes = Vec::with_capacity(theme_rows.len());
    for (id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at) in
        theme_rows
    {
        let terminal_json = serde_json::from_str(&terminal).unwrap_or(Value::String(terminal));
        let highlights_json =
            serde_json::from_str(&highlights).unwrap_or(Value::String(highlights));
        let ui_json = ui.as_ref().and_then(|raw| serde_json::from_str(raw).ok());
        themes.push(ThemeRow {
            id,
            name,
            mode,
            version,
            author,
            terminal: terminal_json,
            highlights: highlights_json,
            ui: ui_json,
            created_at,
            updated_at,
        });
    }

    let payload = BackupPayload {
        schema_version: 1,
        exported_at: Utc::now().to_rfc3339(),
        data: BackupData {
            folders,
            connections,
            settings,
            history,
            logs,
            shortcuts,
            ssh_keys,
            presets,
            themes,
        },
    };

    let json = serde_json::to_string_pretty(&payload).context("序列化备份失败")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, json).context("写入备份文件失败")?;
    Ok(())
}
