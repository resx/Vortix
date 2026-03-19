/* ── 设置 get/put/reset ── */

use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::{Map, Value};

use crate::db::Db;
use super::super::response::{ok, ok_empty, err, ApiResponse};

pub async fn get_settings(State(db): State<Db>) -> Result<Json<ApiResponse<Map<String, Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut settings = Map::new();
    for (key, value) in rows {
        let parsed = serde_json::from_str::<Value>(&value).unwrap_or(Value::String(value));
        settings.insert(key, parsed);
    }
    Ok(ok(settings))
}

pub async fn update_settings(
    State(db): State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let obj = body.as_object().ok_or_else(|| err(StatusCode::BAD_REQUEST, "请求体必须是一个对象"))?;
    let mut tx = db.pool.begin().await.map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    for (key, value) in obj {
        if key.len() > 100 { continue; }
        let serialized = serde_json::to_string(value)
            .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?;
        if serialized.len() > 10240 { continue; }
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
            .bind(key).bind(serialized)
            .execute(&mut *tx).await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    tx.commit().await.map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok_empty())
}

pub async fn reset_settings(State(db): State<Db>) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    sqlx::query("DELETE FROM settings").execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok_empty())
}
