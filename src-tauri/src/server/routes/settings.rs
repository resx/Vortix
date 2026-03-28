/* ── 设置 get/put/reset ── */

use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::{Map, Value};

use super::super::response::{ApiResponse, err, ok, ok_empty};
use crate::{
    db::Db,
    server::helpers::{
        json_maps_equal_unordered, load_settings_map, merge_settings_updates,
        prepare_settings_updates,
    },
    sync::service::mark_sync_dirty,
};

pub async fn get_settings(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Map<String, Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let settings = load_settings_map(&db)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(ok(settings))
}

pub async fn update_settings(
    State(db): State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let obj = body
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "请求体必须是一个对象"))?;
    let current = load_settings_map(&db)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let prepared = prepare_settings_updates(obj)
        .map_err(|e| err(StatusCode::BAD_REQUEST, e))?;
    let next = merge_settings_updates(&current, &prepared.effective_values);
    if json_maps_equal_unordered(&current, &next) {
        return Ok(ok_empty());
    }

    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    for (key, serialized) in prepared.serialized_entries {
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
            .bind(key)
            .bind(serialized)
            .execute(&mut *tx)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    tx.commit()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    mark_sync_dirty(&db)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(ok_empty())
}

pub async fn reset_settings(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM settings")
        .fetch_one(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if count == 0 {
        return Ok(ok_empty());
    }
    sqlx::query("DELETE FROM settings")
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    mark_sync_dirty(&db)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(ok_empty())
}
