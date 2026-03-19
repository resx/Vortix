/* ── 命令历史 ── */

use axum::{extract::{State, Query}, http::StatusCode, response::Json};
use chrono::Utc;
use serde_json::{json, Value};
use std::collections::HashMap;

use crate::db::Db;
use super::super::response::{ok, err, ApiResponse};

pub async fn get_history(
    State(db): State<Db>,
    axum::extract::Path(connection_id): axum::extract::Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let limit = params.get("limit").and_then(|v| v.parse::<i64>().ok()).unwrap_or(100).min(1000);
    let rows: Vec<(i64, String, String, String)> = sqlx::query_as(
        "SELECT id, connection_id, command, executed_at FROM history WHERE connection_id = ? ORDER BY id DESC LIMIT ?",
    ).bind(&connection_id).bind(limit)
    .fetch_all(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result: Vec<Value> = rows.into_iter().map(|(id, conn_id, command, executed_at)| {
        json!({ "id": id, "connection_id": conn_id, "command": command, "executed_at": executed_at })
    }).collect();
    Ok(ok(result))
}

pub async fn add_history(
    State(db): State<Db>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<ApiResponse<Value>>), (StatusCode, Json<ApiResponse<Value>>)> {
    let connection_id = body.get("connection_id").and_then(|v| v.as_str()).unwrap_or("");
    let command = body.get("command").and_then(|v| v.as_str()).unwrap_or("");
    if connection_id.is_empty() || command.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "连接 ID 和命令不能为空"));
    }
    let executed_at = Utc::now().to_rfc3339();
    let result = sqlx::query("INSERT INTO history (connection_id, command, executed_at) VALUES (?, ?, ?)")
        .bind(connection_id).bind(command).bind(&executed_at)
        .execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let id = result.last_insert_rowid();
    Ok((StatusCode::CREATED, ok(json!({ "id": id, "connection_id": connection_id, "command": command, "executed_at": executed_at }))))
}

pub async fn clear_history(
    State(db): State<Db>,
    axum::extract::Path(connection_id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let result = sqlx::query("DELETE FROM history WHERE connection_id = ?")
        .bind(&connection_id).execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(json!({ "deleted": result.rows_affected() })))
}
