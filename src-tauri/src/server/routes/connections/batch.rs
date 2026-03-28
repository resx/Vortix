use super::*;

pub(super) async fn batch_update_connections(
    State(db): State<Db>,
    Json(body): Json<BatchUpdateConnectionsDto>,
) -> Result<Json<ApiResponse<Vec<ConnectionPublic>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    if body.ids.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "ids 不能为空"));
    }
    if body.ids.len() > 100 {
        return Err(err(StatusCode::BAD_REQUEST, "批量操作不能超过 100 条"));
    }
    let obj = body
        .updates
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "updates 不能为空"))?;

    let mut allowed = Map::new();
    for key in [
        "folder_id",
        "color_tag",
        "remark",
        "environment",
        "port",
        "username",
        "auth_type",
        "proxy_type",
        "proxy_host",
        "proxy_port",
        "proxy_username",
        "proxy_timeout",
        "jump_server_id",
        "env_vars",
        "advanced",
    ] {
        if let Some(v) = obj.get(key) {
            allowed.insert(key.to_string(), v.clone());
        }
    }

    let mut enc_pwd: Option<String> = None;
    let mut enc_proxy: Option<String> = None;
    if let Some(Value::String(p)) = obj.get("password") {
        if !p.is_empty() {
            enc_pwd = Some(
                db.crypto
                    .encrypt(p)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
        }
    }
    if let Some(Value::String(p)) = obj.get("proxy_password") {
        if !p.is_empty() {
            enc_proxy = Some(
                db.crypto
                    .encrypt(p)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
        }
    }
    if allowed.is_empty() && enc_pwd.is_none() && enc_proxy.is_none() {
        return Err(err(StatusCode::BAD_REQUEST, "没有可更新的字段"));
    }

    let mut results = Vec::new();
    for id in body.ids {
        let mut row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
            .bind(&id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        let Some(mut row) = row.take() else { continue };
        for (key, value) in &allowed {
            match (key.as_str(), value) {
                ("folder_id", Value::String(v)) => row.folder_id = Some(v.clone()),
                ("folder_id", Value::Null) => row.folder_id = None,
                ("color_tag", Value::String(v)) => row.color_tag = Some(v.clone()),
                ("color_tag", Value::Null) => row.color_tag = None,
                ("remark", Value::String(v)) => row.remark = v.clone(),
                ("environment", Value::String(v)) => row.environment = v.clone(),
                ("port", Value::Number(v)) => {
                    if let Some(p) = v.as_i64() {
                        row.port = p;
                    }
                }
                ("username", Value::String(v)) => row.username = v.clone(),
                ("auth_type", Value::String(v)) => row.auth_type = v.clone(),
                ("proxy_type", Value::String(v)) => row.proxy_type = v.clone(),
                ("proxy_host", Value::String(v)) => row.proxy_host = v.clone(),
                ("proxy_port", Value::Number(v)) => {
                    if let Some(p) = v.as_i64() {
                        row.proxy_port = p;
                    }
                }
                ("proxy_username", Value::String(v)) => row.proxy_username = v.clone(),
                ("proxy_timeout", Value::Number(v)) => {
                    if let Some(p) = v.as_i64() {
                        row.proxy_timeout = p;
                    }
                }
                ("jump_server_id", Value::String(v)) => row.jump_server_id = Some(v.clone()),
                ("jump_server_id", Value::Null) => row.jump_server_id = None,
                ("env_vars", Value::String(v)) => row.env_vars = v.clone(),
                ("advanced", Value::String(v)) => row.advanced = v.clone(),
                _ => {}
            }
        }
        if let Some(ref p) = enc_pwd {
            row.encrypted_password = Some(p.clone());
        }
        if let Some(ref p) = enc_proxy {
            row.proxy_password = p.clone();
        }
        row.updated_at = now_rfc3339();
        update_connection_row(&db, &row).await?;
        results.push(to_connection_public(row));
    }
    if !results.is_empty() {
        mark_local_dirty(&db).await?;
    }
    Ok(ok(results))
}
