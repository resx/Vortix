use super::*;

pub(super) async fn collect_sync_data(db: &Db) -> Result<SyncData, ApiError> {
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
