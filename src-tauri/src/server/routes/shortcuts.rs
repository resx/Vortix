/* ── 快捷命令 CRUD ── */

use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::Value;
use uuid::Uuid;

use super::super::helpers::mark_local_dirty;
use super::super::response::{ApiResponse, err, ok, ok_empty};
use super::super::types::*;
use super::shortcut_groups::ensure_group_for_shortcut;
use crate::db::Db;
use crate::time_utils::now_rfc3339;

pub async fn get_shortcuts(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Vec<ShortcutRow>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows = sqlx::query_as::<_, ShortcutRow>(
        "SELECT id, name, command, remark, group_name, sort_order, created_at, updated_at FROM shortcuts ORDER BY sort_order ASC, name ASC",
    )
    .fetch_all(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(rows))
}

pub async fn create_shortcut(
    State(db): State<Db>,
    Json(body): Json<CreateShortcutDto>,
) -> Result<(StatusCode, Json<ApiResponse<ShortcutRow>>), (StatusCode, Json<ApiResponse<Value>>)> {
    if body.name.trim().is_empty() || body.command.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "name 和 command 为必填项"));
    }
    if body.name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "name 长度不能超过 255"));
    }
    if body.command.len() > 2000 {
        return Err(err(StatusCode::BAD_REQUEST, "command 长度不能超过 2000"));
    }
    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();
    let remark = body.remark.unwrap_or_default();
    let group_name = body.group_name.unwrap_or_default().trim().to_string();
    let sort_order = body.sort_order.unwrap_or(0);
    if group_name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "group_name ?????? 255"));
    }
    ensure_group_for_shortcut(&db, &group_name).await?;

    sqlx::query("INSERT INTO shortcuts (id, name, command, remark, group_name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&body.name).bind(&body.command).bind(&remark).bind(&group_name).bind(sort_order).bind(&now).bind(&now)
        .execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    mark_local_dirty(&db).await?;
    Ok((
        StatusCode::CREATED,
        ok(ShortcutRow {
            id,
            name: body.name,
            command: body.command,
            remark,
            group_name,
            sort_order,
            created_at: now.clone(),
            updated_at: now,
        }),
    ))
}

pub async fn update_shortcut(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<ShortcutRow>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let existing = sqlx::query_as::<_, ShortcutRow>(
        "SELECT id, name, command, remark, group_name, sort_order, created_at, updated_at FROM shortcuts WHERE id = ?",
    )
    .bind(&id).fetch_optional(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(existing) = existing else {
        return Err(err(StatusCode::NOT_FOUND, "快捷命令不存在"));
    };

    let obj = body
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "请求体必须是对象"))?;
    let name = match obj.get("name") {
        Some(Value::String(s)) => s.clone(),
        _ => existing.name.clone(),
    };
    let command = match obj.get("command") {
        Some(Value::String(s)) => s.clone(),
        _ => existing.command.clone(),
    };
    let remark = match obj.get("remark") {
        Some(Value::String(s)) => s.clone(),
        _ => existing.remark.clone(),
    };
    let group_name = match obj.get("group_name") {
        Some(Value::String(s)) => s.trim().to_string(),
        Some(Value::Null) => String::new(),
        _ => existing.group_name.clone(),
    };
    let sort_order = match obj.get("sort_order") {
        Some(Value::Number(n)) => n.as_i64().unwrap_or(existing.sort_order),
        _ => existing.sort_order,
    };
    if group_name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "group_name ?????? 255"));
    }
    ensure_group_for_shortcut(&db, &group_name).await?;

    let updated_at = now_rfc3339();
    sqlx::query("UPDATE shortcuts SET name = ?, command = ?, remark = ?, group_name = ?, sort_order = ?, updated_at = ? WHERE id = ?")
        .bind(&name).bind(&command).bind(&remark).bind(&group_name).bind(sort_order).bind(&updated_at).bind(&id)
        .execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    mark_local_dirty(&db).await?;
    Ok(ok(ShortcutRow {
        id,
        name,
        command,
        remark,
        group_name,
        sort_order,
        created_at: existing.created_at,
        updated_at,
    }))
}

pub async fn delete_shortcut(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let result = sqlx::query("DELETE FROM shortcuts WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(err(StatusCode::NOT_FOUND, "快捷命令不存在"));
    }
    mark_local_dirty(&db).await?;
    Ok(ok_empty())
}
