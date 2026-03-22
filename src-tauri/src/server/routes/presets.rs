/* ── 连接预设 CRUD ── */

use axum::{extract::State, http::StatusCode, response::Json};
use chrono::Utc;
use serde_json::{Value, json};
use uuid::Uuid;

use super::super::response::{ApiResponse, err, ok, ok_empty};
use super::super::types::*;
use crate::db::Db;

pub async fn get_presets(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Vec<PresetPublicRow>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows = sqlx::query_as::<_, PresetPublicRow>(
        "SELECT id, name, username, remark, created_at, updated_at FROM presets ORDER BY name ASC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(rows))
}

pub async fn get_preset(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<PresetPublicRow>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, PresetPublicRow>(
        "SELECT id, name, username, remark, created_at, updated_at FROM presets WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "预设不存在"));
    };
    Ok(ok(row))
}

pub async fn get_preset_credential(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, PresetRow>(
        "SELECT id, name, username, encrypted_password, remark, created_at, updated_at FROM presets WHERE id = ?",
    ).bind(&id).fetch_optional(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "预设不存在"));
    };
    let password = db
        .crypto
        .decrypt(&row.encrypted_password)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(
        json!({ "username": row.username, "password": password }),
    ))
}

pub async fn create_preset(
    State(db): State<Db>,
    Json(body): Json<CreatePresetDto>,
) -> Result<(StatusCode, Json<ApiResponse<PresetPublicRow>>), (StatusCode, Json<ApiResponse<Value>>)>
{
    if body.name.trim().is_empty()
        || body.username.trim().is_empty()
        || body.password.trim().is_empty()
    {
        return Err(err(StatusCode::BAD_REQUEST, "名称、用户名和密码不能为空"));
    }
    if body.name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "名称长度不能超过 255"));
    }
    let encrypted_password = db
        .crypto
        .encrypt(&body.password)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let remark = body.remark.unwrap_or_default();

    sqlx::query("INSERT INTO presets (id, name, username, encrypted_password, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&body.name).bind(&body.username).bind(encrypted_password).bind(&remark).bind(&now).bind(&now)
        .execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        ok(PresetPublicRow {
            id,
            name: body.name,
            username: body.username,
            remark,
            created_at: now.clone(),
            updated_at: now,
        }),
    ))
}

pub async fn update_preset(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<PresetPublicRow>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let existing = sqlx::query_as::<_, PresetRow>(
        "SELECT id, name, username, encrypted_password, remark, created_at, updated_at FROM presets WHERE id = ?",
    ).bind(&id).fetch_optional(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(existing) = existing else {
        return Err(err(StatusCode::NOT_FOUND, "预设不存在"));
    };

    let obj = body
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "请求体必须是对象"))?;
    let name = match obj.get("name") {
        Some(Value::String(s)) => s.clone(),
        _ => existing.name.clone(),
    };
    let username = match obj.get("username") {
        Some(Value::String(s)) => s.clone(),
        _ => existing.username.clone(),
    };
    let remark = match obj.get("remark") {
        Some(Value::String(s)) => s.clone(),
        _ => existing.remark.clone(),
    };
    let encrypted_password = match obj.get("password") {
        Some(Value::String(s)) if !s.trim().is_empty() => db
            .crypto
            .encrypt(s)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        _ => existing.encrypted_password.clone(),
    };

    let updated_at = Utc::now().to_rfc3339();
    sqlx::query("UPDATE presets SET name = ?, username = ?, encrypted_password = ?, remark = ?, updated_at = ? WHERE id = ?")
        .bind(&name).bind(&username).bind(&encrypted_password).bind(&remark).bind(&updated_at).bind(&id)
        .execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(ok(PresetPublicRow {
        id,
        name,
        username,
        remark,
        created_at: existing.created_at,
        updated_at,
    }))
}

pub async fn delete_preset(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let result = sqlx::query("DELETE FROM presets WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(err(StatusCode::NOT_FOUND, "预设不存在"));
    }
    sqlx::query(
        "UPDATE connections SET preset_id = NULL, auth_type = 'password' WHERE preset_id = ?",
    )
    .bind(&id)
    .execute(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok_empty())
}
