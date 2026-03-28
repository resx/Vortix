use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::Json;
use serde_json::{Value, json};
use std::collections::HashMap;

use super::super::response::{ApiResponse, err, ok};
use crate::db::Db;

pub async fn get_transfer_history(
    State(db): State<Db>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let limit = params
        .get("limit")
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(100)
        .clamp(1, 1000);
    let before_id = params
        .get("beforeId")
        .and_then(|v| v.parse::<i64>().ok())
        .filter(|v| *v > 0);

    let session_key = params.get("sessionKey").map(|v| v.trim()).unwrap_or("");
    let rows: Vec<(i64, String, String, String, i64, i64, String, Option<String>, String)> = match (
        session_key.is_empty(),
        before_id,
    ) {
        (true, None) => {
            sqlx::query_as(
                "SELECT id, transfer_id, direction, remote_path, bytes_transferred, file_size, status, error_message, created_at
                 FROM transfer_history
                 ORDER BY id DESC
                 LIMIT ?",
            )
            .bind(limit as i64)
            .fetch_all(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        }
        (true, Some(before)) => {
            sqlx::query_as(
                "SELECT id, transfer_id, direction, remote_path, bytes_transferred, file_size, status, error_message, created_at
                 FROM transfer_history
                 WHERE id < ?
                 ORDER BY id DESC
                 LIMIT ?",
            )
            .bind(before)
            .bind(limit as i64)
            .fetch_all(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        }
        (false, None) => {
            sqlx::query_as(
                "SELECT id, transfer_id, direction, remote_path, bytes_transferred, file_size, status, error_message, created_at
                 FROM transfer_history
                 WHERE session_key = ?
                 ORDER BY id DESC
                 LIMIT ?",
            )
            .bind(session_key)
            .bind(limit as i64)
            .fetch_all(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        }
        (false, Some(before)) => {
            sqlx::query_as(
                "SELECT id, transfer_id, direction, remote_path, bytes_transferred, file_size, status, error_message, created_at
                 FROM transfer_history
                 WHERE session_key = ? AND id < ?
                 ORDER BY id DESC
                 LIMIT ?",
            )
            .bind(session_key)
            .bind(before)
            .bind(limit as i64)
            .fetch_all(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        }
    };

    let result = rows
        .into_iter()
        .map(
            |(
                id,
                transfer_id,
                direction,
                remote_path,
                bytes_transferred,
                file_size,
                status,
                error_message,
                created_at,
            )| {
                json!({
                    "id": id,
                    "transferId": transfer_id,
                    "direction": direction,
                    "remotePath": remote_path,
                    "bytesTransferred": bytes_transferred,
                    "fileSize": file_size,
                    "status": status,
                    "errorMessage": error_message,
                    "createdAt": created_at
                })
            },
        )
        .collect();

    Ok(ok(result))
}
