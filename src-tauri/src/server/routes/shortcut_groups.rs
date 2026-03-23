/* 快捷命令分组 CRUD */

use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::Value;
use uuid::Uuid;

use super::super::helpers::mark_local_dirty;
use super::super::response::{ApiResponse, err, ok, ok_empty};
use super::super::types::*;
use crate::db::Db;
use crate::time_utils::now_rfc3339;

fn normalize_group_name(input: &str) -> String {
    input.trim().to_string()
}

async fn ensure_shortcut_group_exists(db: &Db, name: &str) -> Result<(), (StatusCode, Json<ApiResponse<Value>>)> {
    if name.trim().is_empty() {
        return Ok(());
    }
    let now = now_rfc3339();
    sqlx::query(
        "INSERT OR IGNORE INTO shortcut_groups (id, name, sort_order, created_at, updated_at) VALUES (?, ?, 0, ?, ?)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(name)
    .bind(&now)
    .bind(&now)
    .execute(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(())
}

pub async fn get_shortcut_groups(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Vec<ShortcutGroupRow>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows = sqlx::query_as::<_, ShortcutGroupRow>(
        "SELECT id, name, sort_order, created_at, updated_at FROM shortcut_groups ORDER BY sort_order ASC, name ASC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(rows))
}

pub async fn create_shortcut_group(
    State(db): State<Db>,
    Json(body): Json<CreateShortcutGroupDto>,
) -> Result<(StatusCode, Json<ApiResponse<ShortcutGroupRow>>), (StatusCode, Json<ApiResponse<Value>>)> {
    let name = normalize_group_name(&body.name);
    if name.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "group name required"));
    }
    if name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "group name too long"));
    }

    let exists: Option<String> = sqlx::query_scalar("SELECT id FROM shortcut_groups WHERE name = ?")
        .bind(&name)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if exists.is_some() {
        return Err(err(StatusCode::BAD_REQUEST, "group already exists"));
    }

    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();
    let sort_order = body.sort_order.unwrap_or(0);

    sqlx::query("INSERT INTO shortcut_groups (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(sort_order)
        .bind(&now)
        .bind(&now)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    mark_local_dirty(&db).await?;
    Ok((
        StatusCode::CREATED,
        ok(ShortcutGroupRow {
            id,
            name,
            sort_order,
            created_at: now.clone(),
            updated_at: now,
        }),
    ))
}

pub async fn update_shortcut_group(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<ShortcutGroupRow>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let existing = sqlx::query_as::<_, ShortcutGroupRow>(
        "SELECT id, name, sort_order, created_at, updated_at FROM shortcut_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(existing) = existing else {
        return Err(err(StatusCode::NOT_FOUND, "group not found"));
    };

    let obj = body
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "invalid body"))?;
    let name = match obj.get("name") {
        Some(Value::String(s)) => normalize_group_name(s),
        _ => existing.name.clone(),
    };
    if name.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "group name required"));
    }
    if name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "group name too long"));
    }

    let sort_order = match obj.get("sort_order") {
        Some(Value::Number(n)) => n.as_i64().unwrap_or(existing.sort_order),
        _ => existing.sort_order,
    };

    if name != existing.name {
        let duplicate: Option<String> = sqlx::query_scalar(
            "SELECT id FROM shortcut_groups WHERE name = ? AND id <> ?",
        )
        .bind(&name)
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        if duplicate.is_some() {
            return Err(err(StatusCode::BAD_REQUEST, "group already exists"));
        }
    }

    let updated_at = now_rfc3339();
    sqlx::query("UPDATE shortcut_groups SET name = ?, sort_order = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(sort_order)
        .bind(&updated_at)
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if name != existing.name {
        sqlx::query("UPDATE shortcuts SET group_name = ?, updated_at = ? WHERE group_name = ?")
            .bind(&name)
            .bind(&updated_at)
            .bind(&existing.name)
            .execute(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    mark_local_dirty(&db).await?;
    Ok(ok(ShortcutGroupRow {
        id,
        name,
        sort_order,
        created_at: existing.created_at,
        updated_at,
    }))
}

pub async fn delete_shortcut_group(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let existing_name: Option<String> = sqlx::query_scalar("SELECT name FROM shortcut_groups WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(existing_name) = existing_name else {
        return Err(err(StatusCode::NOT_FOUND, "group not found"));
    };

    let updated_at = now_rfc3339();
    sqlx::query("UPDATE shortcuts SET group_name = '', updated_at = ? WHERE group_name = ?")
        .bind(&updated_at)
        .bind(&existing_name)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query("DELETE FROM shortcut_groups WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    mark_local_dirty(&db).await?;
    Ok(ok_empty())
}

pub async fn ensure_group_for_shortcut(
    db: &Db,
    group_name: &str,
) -> Result<(), (StatusCode, Json<ApiResponse<Value>>)> {
    ensure_shortcut_group_exists(db, group_name).await
}
