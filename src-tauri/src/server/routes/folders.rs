/* ── 文件夹 CRUD ── */

use axum::{extract::State, http::StatusCode, response::Json};
use chrono::Utc;
use serde_json::Value;
use uuid::Uuid;

use super::super::helpers::mark_local_dirty;
use super::super::response::{ApiResponse, err, ok, ok_empty};
use super::super::types::*;
use crate::db::Db;

pub async fn get_folders(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Vec<FolderRow>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows = sqlx::query_as::<_, FolderRow>(
        "SELECT id, name, parent_id, sort_order, created_at, updated_at FROM folders ORDER BY sort_order ASC, name ASC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(rows))
}

pub async fn create_folder(
    State(db): State<Db>,
    Json(body): Json<CreateFolderDto>,
) -> Result<(StatusCode, Json<ApiResponse<FolderRow>>), (StatusCode, Json<ApiResponse<Value>>)> {
    if body.name.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "文件夹名称不能为空"));
    }
    if body.name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "文件夹名称长度不能超过 255"));
    }
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    let sort_order = body.sort_order.unwrap_or(0);

    sqlx::query("INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(&id).bind(&body.name).bind(&body.parent_id).bind(sort_order).bind(&now).bind(&now)
        .execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    mark_local_dirty(&db).await?;
    Ok((
        StatusCode::CREATED,
        ok(FolderRow {
            id,
            name: body.name,
            parent_id: body.parent_id,
            sort_order,
            created_at: now.clone(),
            updated_at: now,
        }),
    ))
}

pub async fn update_folder(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<FolderRow>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let existing = sqlx::query_as::<_, FolderRow>(
        "SELECT id, name, parent_id, sort_order, created_at, updated_at FROM folders WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(existing) = existing else {
        return Err(err(StatusCode::NOT_FOUND, "文件夹不存在"));
    };

    let obj = body
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "请求体必须是对象"))?;
    let name = match obj.get("name") {
        Some(Value::String(s)) => s.clone(),
        _ => existing.name.clone(),
    };
    let parent_id = if obj.contains_key("parent_id") {
        match obj.get("parent_id") {
            Some(Value::Null) => None,
            Some(Value::String(s)) => Some(s.clone()),
            _ => existing.parent_id.clone(),
        }
    } else {
        existing.parent_id.clone()
    };
    let sort_order = match obj.get("sort_order") {
        Some(Value::Number(n)) => n.as_i64().unwrap_or(existing.sort_order),
        _ => existing.sort_order,
    };

    let updated_at = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE folders SET name = ?, parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&parent_id)
    .bind(sort_order)
    .bind(&updated_at)
    .bind(&id)
    .execute(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    mark_local_dirty(&db).await?;
    Ok(ok(FolderRow {
        id,
        name,
        parent_id,
        sort_order,
        created_at: existing.created_at,
        updated_at,
    }))
}

pub async fn delete_folder(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let result = sqlx::query("DELETE FROM folders WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(err(StatusCode::NOT_FOUND, "文件夹不存在"));
    }
    mark_local_dirty(&db).await?;
    Ok(ok_empty())
}
