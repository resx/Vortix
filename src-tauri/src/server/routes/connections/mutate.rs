use super::*;

pub(super) async fn create_connection(
    State(db): State<Db>,
    Json(body): Json<CreateConnectionDto>,
) -> Result<(StatusCode, Json<ApiResponse<ConnectionPublic>>), (StatusCode, Json<ApiResponse<Value>>)>
{
    if body.name.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "名称不能为空"));
    }
    if body.name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "名称长度不能超过 255"));
    }
    let protocol = body.protocol.unwrap_or_else(|| "ssh".to_string());
    let is_local = protocol == "local";
    let host = body.host.unwrap_or_else(|| if is_local { "local".to_string() } else { "".to_string() });
    let username = body.username.unwrap_or_else(|| if is_local { "local".to_string() } else { "".to_string() });
    if !is_local {
        if host.is_empty() || username.is_empty() {
            return Err(err(StatusCode::BAD_REQUEST, "名称、主机和用户名不能为空"));
        }
        if host.len() > 255 {
            return Err(err(StatusCode::BAD_REQUEST, "主机地址长度不能超过 255"));
        }
        if username.len() > 255 {
            return Err(err(StatusCode::BAD_REQUEST, "用户名长度不能超过 255"));
        }
    }
    if let Some(port) = body.port {
        if !(1..=65535).contains(&port) {
            return Err(err(StatusCode::BAD_REQUEST, "端口号必须在 1-65535 之间"));
        }
    }

    let encrypted_password = match body.password {
        Some(ref pwd) if !pwd.is_empty() => Some(
            db.crypto.encrypt(pwd).map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        _ => None,
    };
    let encrypted_private_key = match body.private_key {
        Some(ref key) if !key.is_empty() => Some(
            db.crypto.encrypt(key).map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        _ => None,
    };
    let encrypted_proxy_password = match body.proxy_password {
        Some(ref pwd) if !pwd.is_empty() => Some(
            db.crypto.encrypt(pwd).map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        Some(_) => Some(String::new()),
        None => None,
    };
    let encrypted_passphrase = match body.passphrase {
        Some(ref pass) if !pass.is_empty() => Some(
            db.crypto.encrypt(pass).map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        _ => None,
    };

    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();
    let row = ConnectionRow {
        id: id.clone(),
        folder_id: body.folder_id,
        name: body.name,
        protocol,
        host,
        port: body.port.unwrap_or(22),
        username,
        auth_method: body.auth_method.unwrap_or_else(|| "password".to_string()),
        encrypted_password,
        encrypted_private_key,
        sort_order: 0,
        remark: body.remark.unwrap_or_default(),
        color_tag: body.color_tag,
        environment: body.environment.unwrap_or_else(|| "无".to_string()),
        auth_type: body.auth_type.unwrap_or_else(|| "password".to_string()),
        proxy_type: body.proxy_type.unwrap_or_else(|| "关闭".to_string()),
        proxy_host: body.proxy_host.unwrap_or_else(|| "127.0.0.1".to_string()),
        proxy_port: body.proxy_port.unwrap_or(7890),
        proxy_username: body.proxy_username.unwrap_or_default(),
        proxy_password: encrypted_proxy_password.unwrap_or_default(),
        proxy_timeout: body.proxy_timeout.unwrap_or(5),
        jump_server_id: body.jump_server_id,
        preset_id: body.preset_id,
        private_key_id: body.private_key_id,
        jump_key_id: body.jump_key_id,
        encrypted_passphrase,
        tunnels: body.tunnels.unwrap_or_else(|| "[]".to_string()),
        env_vars: body.env_vars.unwrap_or_else(|| "[]".to_string()),
        advanced: body.advanced.unwrap_or_else(|| "{}".to_string()),
        created_at: now.clone(),
        updated_at: now,
    };
    insert_connection(&db, &row).await?;
    mark_local_dirty(&db).await?;
    Ok((StatusCode::CREATED, ok(to_connection_public(row))))
}

pub(super) async fn update_connection(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<ConnectionPublic>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let mut row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| err(StatusCode::NOT_FOUND, "连接不存在"))?;
    let obj = body
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "请求体必须是对象"))?;

    if let Some(Value::String(v)) = obj.get("folder_id") { row.folder_id = Some(v.clone()); }
    else if obj.contains_key("folder_id") { row.folder_id = None; }
    if let Some(Value::String(v)) = obj.get("name") { row.name = v.clone(); }
    if let Some(Value::String(v)) = obj.get("protocol") { row.protocol = v.clone(); }
    if let Some(Value::String(v)) = obj.get("host") { row.host = v.clone(); }
    if let Some(Value::Number(v)) = obj.get("port") { if let Some(p) = v.as_i64() { row.port = p; } }
    if let Some(Value::String(v)) = obj.get("username") { row.username = v.clone(); }
    if let Some(Value::String(v)) = obj.get("auth_method") { row.auth_method = v.clone(); }
    if let Some(Value::String(v)) = obj.get("remark") { row.remark = v.clone(); }
    if let Some(Value::String(v)) = obj.get("color_tag") { row.color_tag = Some(v.clone()); }
    if obj.contains_key("color_tag") && obj.get("color_tag") == Some(&Value::Null) { row.color_tag = None; }
    if let Some(Value::String(v)) = obj.get("environment") { row.environment = v.clone(); }
    if let Some(Value::String(v)) = obj.get("auth_type") { row.auth_type = v.clone(); }
    if let Some(Value::String(v)) = obj.get("proxy_type") { row.proxy_type = v.clone(); }
    if let Some(Value::String(v)) = obj.get("proxy_host") { row.proxy_host = v.clone(); }
    if let Some(Value::Number(v)) = obj.get("proxy_port") { if let Some(p) = v.as_i64() { row.proxy_port = p; } }
    if let Some(Value::String(v)) = obj.get("proxy_username") { row.proxy_username = v.clone(); }
    if let Some(Value::Number(v)) = obj.get("proxy_timeout") { if let Some(p) = v.as_i64() { row.proxy_timeout = p; } }
    if let Some(Value::String(v)) = obj.get("jump_server_id") { row.jump_server_id = Some(v.clone()); }
    if obj.contains_key("jump_server_id") && obj.get("jump_server_id") == Some(&Value::Null) { row.jump_server_id = None; }
    if let Some(Value::String(v)) = obj.get("preset_id") { row.preset_id = Some(v.clone()); }
    if obj.contains_key("preset_id") && obj.get("preset_id") == Some(&Value::Null) { row.preset_id = None; }
    if let Some(Value::String(v)) = obj.get("private_key_id") { row.private_key_id = Some(v.clone()); }
    if obj.contains_key("private_key_id") && obj.get("private_key_id") == Some(&Value::Null) { row.private_key_id = None; }
    if let Some(Value::String(v)) = obj.get("jump_key_id") { row.jump_key_id = Some(v.clone()); }
    if obj.contains_key("jump_key_id") && obj.get("jump_key_id") == Some(&Value::Null) { row.jump_key_id = None; }
    if let Some(Value::String(v)) = obj.get("tunnels") { row.tunnels = v.clone(); }
    if let Some(Value::String(v)) = obj.get("env_vars") { row.env_vars = v.clone(); }
    if let Some(Value::String(v)) = obj.get("advanced") { row.advanced = v.clone(); }

    if obj.contains_key("password") {
        match obj.get("password") {
            Some(Value::String(v)) if !v.is_empty() => {
                row.encrypted_password = Some(db.crypto.encrypt(v).map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?);
            }
            _ => row.encrypted_password = None,
        }
    }
    if obj.contains_key("private_key") {
        match obj.get("private_key") {
            Some(Value::String(v)) if !v.is_empty() => {
                row.encrypted_private_key = Some(db.crypto.encrypt(v).map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?);
            }
            _ => row.encrypted_private_key = None,
        }
    }
    if obj.contains_key("proxy_password") {
        match obj.get("proxy_password") {
            Some(Value::String(v)) if !v.is_empty() => {
                row.proxy_password = db.crypto.encrypt(v).map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            }
            _ => row.proxy_password = "".to_string(),
        }
    }
    if obj.contains_key("passphrase") {
        match obj.get("passphrase") {
            Some(Value::String(v)) if !v.is_empty() => {
                row.encrypted_passphrase = Some(db.crypto.encrypt(v).map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?);
            }
            _ => row.encrypted_passphrase = None,
        }
    }

    row.updated_at = now_rfc3339();
    update_connection_row(&db, &row).await?;
    mark_local_dirty(&db).await?;
    Ok(ok(to_connection_public(row)))
}

pub(super) async fn delete_connection(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let result = sqlx::query("DELETE FROM connections WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(err(StatusCode::NOT_FOUND, "连接不存在"));
    }
    mark_local_dirty(&db).await?;
    Ok(ok_empty())
}
