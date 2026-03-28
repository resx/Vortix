use super::*;

pub(super) async fn get_connections(
    State(db): State<Db>,
    Query(query): Query<ConnectionListQuery>,
) -> Result<Json<ApiResponse<Vec<ConnectionPublic>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows = if let Some(folder_id) = query.folder_id {
        sqlx::query_as::<_, ConnectionRow>(
            "SELECT * FROM connections WHERE folder_id = ? ORDER BY sort_order ASC, name ASC",
        )
        .bind(folder_id)
        .fetch_all(&db.pool)
        .await
    } else {
        sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections ORDER BY sort_order ASC, name ASC")
            .fetch_all(&db.pool)
            .await
    }
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(rows.into_iter().map(to_connection_public).collect()))
}

pub(super) async fn get_connection(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<ConnectionPublic>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "连接不存在"));
    };
    Ok(ok(to_connection_public(row)))
}

pub(super) async fn get_connection_credential(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "连接不存在"));
    };

    let mut auth = resolve_connection_auth(&db, &row).await?;
    let (jump_key_private_key, jump_key_passphrase) =
        resolve_key_material(&db, row.jump_key_id.as_deref()).await?;
    let mut proxy_password: Option<String> = None;

    if row.auth_type == "jump" && auth.private_key.is_none() && jump_key_private_key.is_some() {
        auth.private_key = jump_key_private_key.clone();
        auth.passphrase = jump_key_passphrase.clone();
        auth.password = None;
    }

    if !row.proxy_password.is_empty() {
        proxy_password = Some(
            db.crypto
                .decrypt(&row.proxy_password)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        );
    }

    let jump = resolve_jump_connection_payload(&db, &row).await?;

    Ok(ok(json!({
        "host": row.host, "port": row.port, "username": auth.username,
        "password": auth.password, "private_key": auth.private_key, "passphrase": auth.passphrase,
        "jump": jump,
        "proxy_password": proxy_password,
    })))
}

pub(super) async fn get_connection_keys(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Vec<ConnectionKeyInfo>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows = sqlx::query_as::<_, ConnectionRow>(
        "SELECT * FROM connections WHERE encrypted_private_key IS NOT NULL",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut keys = Vec::new();
    for row in rows {
        let enc = match row.encrypted_private_key {
            Some(v) if !v.is_empty() => v,
            _ => continue,
        };
        if let Ok(private_key) = db.crypto.decrypt(&enc) {
            keys.push(ConnectionKeyInfo {
                id: row.id,
                name: row.name,
                host: row.host,
                privateKey: private_key,
            });
        }
    }
    Ok(ok(keys))
}
