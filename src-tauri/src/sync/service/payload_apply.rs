use super::*;

pub(super) async fn apply_sync_payload(db: &Db, data: SyncData) -> Result<SyncImportResult, ApiError> {
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
