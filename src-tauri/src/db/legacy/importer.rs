use anyhow::Result;
use sqlx::SqlitePool;
use std::path::Path;

use super::models::{
    ConnectionRow, FolderRow, HistoryRow, ImportSummary, LogRow, PresetRow, ShortcutGroupRow,
    ShortcutRow, SshKeyRow, SyncState, ThemeRow,
};
use super::readers::{read_json, read_json_array, read_json_object, read_jsonl};

pub async fn import_all(legacy_dir: &Path, pool: &SqlitePool) -> Result<ImportSummary> {
    let mut summary = ImportSummary::default();
    let config_dir = legacy_dir.join("config");
    let logs_dir = legacy_dir.join("logs");
    let mut tx = pool.begin().await?;

    if let Some(rows) = read_json_array::<FolderRow>(&config_dir.join("folders.json"))? {
        for row in rows {
            sqlx::query("INSERT OR REPLACE INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(row.id).bind(row.name).bind(row.parent_id).bind(row.sort_order.unwrap_or(0))
                .bind(row.created_at).bind(row.updated_at).execute(&mut *tx).await?;
            summary.folders += 1;
        }
    }

    if let Some(rows) = read_json_array::<PresetRow>(&config_dir.join("presets.json"))? {
        for row in rows {
            sqlx::query("INSERT OR REPLACE INTO presets (id, name, username, encrypted_password, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(row.id).bind(row.name).bind(row.username).bind(row.encrypted_password)
                .bind(row.remark.unwrap_or_default()).bind(row.created_at).bind(row.updated_at)
                .execute(&mut *tx).await?;
            summary.presets += 1;
        }
    }

    if let Some(rows) = read_json_array::<SshKeyRow>(&config_dir.join("ssh-keys.json"))? {
        for row in rows {
            sqlx::query("INSERT OR REPLACE INTO ssh_keys (id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(row.id).bind(row.name).bind(row.key_type).bind(row.public_key)
                .bind(if row.has_passphrase { 1 } else { 0 }).bind(row.encrypted_private_key)
                .bind(row.encrypted_passphrase).bind(row.certificate)
                .bind(row.remark.unwrap_or_default()).bind(row.description.unwrap_or_default())
                .bind(row.created_at).execute(&mut *tx).await?;
            summary.ssh_keys += 1;
        }
    }

    if let Some(rows) = read_json_array::<ConnectionRow>(&config_dir.join("connections.json"))? {
        for row in rows {
            sqlx::query("INSERT OR REPLACE INTO connections (id, folder_id, name, protocol, host, port, username, auth_method, encrypted_password, encrypted_private_key, sort_order, remark, color_tag, environment, auth_type, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password, proxy_timeout, jump_server_id, preset_id, private_key_id, jump_key_id, encrypted_passphrase, tunnels, env_vars, advanced, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(row.id).bind(row.folder_id).bind(row.name).bind(row.protocol).bind(row.host)
                .bind(row.port).bind(row.username).bind(row.auth_method).bind(row.encrypted_password)
                .bind(row.encrypted_private_key).bind(row.sort_order.unwrap_or(0))
                .bind(row.remark.unwrap_or_default()).bind(row.color_tag)
                .bind(row.environment.unwrap_or_else(|| "无".to_string()))
                .bind(row.auth_type.unwrap_or_else(|| "password".to_string()))
                .bind(row.proxy_type.unwrap_or_else(|| "关闭".to_string()))
                .bind(row.proxy_host.unwrap_or_else(|| "127.0.0.1".to_string()))
                .bind(row.proxy_port.unwrap_or(7890)).bind(row.proxy_username.unwrap_or_default())
                .bind(row.proxy_password.unwrap_or_default()).bind(row.proxy_timeout.unwrap_or(5))
                .bind(row.jump_server_id).bind(row.preset_id).bind(row.private_key_id)
                .bind(row.jump_key_id).bind(row.encrypted_passphrase)
                .bind(row.tunnels.unwrap_or_else(|| "[]".to_string()))
                .bind(row.env_vars.unwrap_or_else(|| "[]".to_string()))
                .bind(row.advanced.unwrap_or_else(|| "{}".to_string()))
                .bind(row.created_at).bind(row.updated_at).execute(&mut *tx).await?;
            summary.connections += 1;
        }
    }

    if let Some(rows) = read_json_array::<ShortcutRow>(&config_dir.join("shortcuts.json"))? {
        for row in rows {
            sqlx::query("INSERT OR REPLACE INTO shortcuts (id, name, command, remark, group_name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(row.id).bind(row.name).bind(row.command).bind(row.remark.unwrap_or_default())
                .bind(row.group_name.unwrap_or_default()).bind(row.sort_order.unwrap_or(0))
                .bind(row.created_at).bind(row.updated_at).execute(&mut *tx).await?;
            summary.shortcuts += 1;
        }
    }

    if let Some(rows) = read_json_array::<ShortcutGroupRow>(&config_dir.join("shortcut-groups.json"))? {
        for row in rows {
            sqlx::query("INSERT OR REPLACE INTO shortcut_groups (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
                .bind(row.id).bind(row.name).bind(row.sort_order.unwrap_or(0))
                .bind(row.created_at).bind(row.updated_at).execute(&mut *tx).await?;
        }
    }

    if let Some(settings) = read_json_object(&config_dir.join("settings.json"))? {
        for (key, value) in settings {
            let serialized = serde_json::to_string(&value)?;
            sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
                .bind(key).bind(serialized).execute(&mut *tx).await?;
            summary.settings += 1;
        }
    }

    if let Some(rows) = read_json_array::<ThemeRow>(&config_dir.join("themes.json"))? {
        for row in rows {
            let terminal = serde_json::to_string(&row.terminal)?;
            let highlights = serde_json::to_string(&row.highlights)?;
            let ui = row.ui.as_ref().map(serde_json::to_string).transpose()?;
            sqlx::query("INSERT OR REPLACE INTO themes (id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .bind(row.id).bind(row.name).bind(row.mode).bind(row.version.unwrap_or(1))
                .bind(row.author.unwrap_or_default()).bind(terminal).bind(highlights).bind(ui)
                .bind(row.created_at).bind(row.updated_at).execute(&mut *tx).await?;
            summary.themes += 1;
        }
    }

    if let Some(rows) = read_jsonl::<HistoryRow>(&logs_dir.join("command-history.jsonl"))? {
        for row in rows {
            sqlx::query("INSERT OR REPLACE INTO history (id, connection_id, command, executed_at) VALUES (?, ?, ?, ?)")
                .bind(row.id).bind(row.connection_id).bind(row.command).bind(row.executed_at)
                .execute(&mut *tx).await?;
            summary.history += 1;
        }
    }

    if let Some(rows) = read_jsonl::<LogRow>(&logs_dir.join("connection-logs.jsonl"))? {
        for row in rows {
            sqlx::query("INSERT OR REPLACE INTO logs (id, connection_id, event, message, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(row.id).bind(row.connection_id).bind(row.event)
                .bind(row.message.unwrap_or_default()).bind(row.duration_ms).bind(row.created_at)
                .execute(&mut *tx).await?;
            summary.logs += 1;
        }
    }

    if let Some(state) = read_json::<SyncState>(&legacy_dir.join("sync-state.json"))? {
        sqlx::query("INSERT OR REPLACE INTO sync_state (id, device_id, last_sync_revision, last_sync_at, local_dirty) VALUES (1, ?, ?, ?, ?)")
            .bind(state.device_id).bind(state.last_sync_revision).bind(state.last_sync_at)
            .bind(if state.local_dirty { 1 } else { 0 }).execute(&mut *tx).await?;
    }

    tx.commit().await?;
    Ok(summary)
}
