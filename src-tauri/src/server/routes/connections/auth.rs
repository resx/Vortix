use super::*;

pub(super) struct ResolvedConnectionAuth {
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
}

pub(super) async fn resolve_key_material(
    db: &Db,
    key_id: Option<&str>,
) -> Result<(Option<String>, Option<String>), (StatusCode, Json<ApiResponse<Value>>)> {
    let Some(key_id) = key_id else {
        return Ok((None, None));
    };

    let key_row = sqlx::query_as::<_, SshKeyRawRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
    )
    .bind(key_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(key_row) = key_row else {
        return Ok((None, None));
    };

    let private_key = Some(
        db.crypto
            .decrypt(&key_row.encrypted_private_key)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
    );
    let passphrase = match key_row.encrypted_passphrase {
        Some(enc_pp) => Some(
            db.crypto
                .decrypt(&enc_pp)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        None => None,
    };

    Ok((private_key, passphrase))
}

pub(super) async fn resolve_connection_auth(
    db: &Db,
    row: &ConnectionRow,
) -> Result<ResolvedConnectionAuth, (StatusCode, Json<ApiResponse<Value>>)> {
    let mut username = row.username.clone();
    let mut password: Option<String> = None;
    let mut private_key: Option<String> = None;
    let mut passphrase: Option<String> = None;

    if let Some(preset_id) = &row.preset_id {
        let preset = sqlx::query_as::<_, PresetRow>("SELECT * FROM presets WHERE id = ?")
            .bind(preset_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        if let Some(preset) = preset {
            username = preset.username;
            password = Some(
                db.crypto
                    .decrypt(&preset.encrypted_password)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
        }
    } else if let Some(enc_pwd) = &row.encrypted_password {
        if !enc_pwd.is_empty() {
            password = Some(
                db.crypto
                    .decrypt(enc_pwd)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
        }
    }

    let (key_private_key, key_passphrase) =
        resolve_key_material(db, row.private_key_id.as_deref()).await?;
    if key_private_key.is_some() {
        private_key = key_private_key;
        passphrase = key_passphrase;
    } else if let Some(enc_key) = &row.encrypted_private_key {
        if !enc_key.is_empty() {
            private_key = Some(
                db.crypto
                    .decrypt(enc_key)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
            if let Some(enc_pp) = &row.encrypted_passphrase {
                if !enc_pp.is_empty() {
                    passphrase = Some(
                        db.crypto
                            .decrypt(enc_pp)
                            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
                    );
                }
            }
        }
    }

    Ok(ResolvedConnectionAuth {
        username,
        password,
        private_key,
        passphrase,
    })
}

pub(super) async fn resolve_jump_host_config_by_id(
    db: &Db,
    jump_server_id: Option<&str>,
    override_key_id: Option<&str>,
) -> Result<Option<RusshJumpHostConfig>, (StatusCode, Json<ApiResponse<Value>>)> {
    let Some(jump_server_id) = jump_server_id else {
        return Ok(None);
    };

    let jump_row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(jump_server_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(jump_row) = jump_row else {
        return Ok(None);
    };

    let mut jump_auth = resolve_connection_auth(db, &jump_row).await?;

    if jump_row.auth_type == "jump" && jump_auth.private_key.is_none() {
        let (jump_private_key, jump_passphrase) =
            resolve_key_material(db, jump_row.jump_key_id.as_deref()).await?;
        if jump_private_key.is_some() {
            jump_auth.private_key = jump_private_key;
            jump_auth.passphrase = jump_passphrase;
            jump_auth.password = None;
        }
    }

    let (override_private_key, override_passphrase) =
        resolve_key_material(db, override_key_id).await?;
    if override_private_key.is_some() {
        jump_auth.private_key = override_private_key;
        jump_auth.passphrase = override_passphrase;
        jump_auth.password = None;
    }

    Ok(Some(RusshJumpHostConfig {
        endpoint: RusshEndpoint {
            host: jump_row.host,
            port: jump_row.port as u16,
            username: jump_auth.username.clone(),
            connection_id: Some(jump_row.id),
            connection_name: Some(jump_row.name),
        },
        auth: RusshAuthConfig {
            password: jump_auth.password,
            private_key: jump_auth.private_key,
            passphrase: jump_auth.passphrase,
        },
    }))
}

pub(super) async fn resolve_jump_host_config(
    db: &Db,
    row: &ConnectionRow,
) -> Result<Option<RusshJumpHostConfig>, (StatusCode, Json<ApiResponse<Value>>)> {
    resolve_jump_host_config_by_id(
        db,
        row.jump_server_id.as_deref(),
        row.jump_key_id.as_deref(),
    )
    .await
}

pub(super) async fn resolve_jump_connection_payload(
    db: &Db,
    row: &ConnectionRow,
) -> Result<Option<Value>, (StatusCode, Json<ApiResponse<Value>>)> {
    let Some(jump) = resolve_jump_host_config(db, row).await? else {
        return Ok(None);
    };
    let RusshJumpHostConfig {
        endpoint:
            RusshEndpoint {
                host,
                port,
                username,
                connection_id,
                connection_name,
            },
        auth:
            RusshAuthConfig {
                password,
                private_key,
                passphrase,
            },
    } = jump;

    Ok(Some(json!({
        "connectionId": connection_id,
        "connectionName": connection_name,
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "private_key": private_key,
        "passphrase": passphrase,
    })))
}
