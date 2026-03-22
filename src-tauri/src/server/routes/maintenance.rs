use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};

use super::super::helpers::mark_local_dirty;
use super::super::remote_history::{clear_all_remote_history, delete_orphan_command_history_files};
use super::super::response::{ApiResponse, err, ok, ok_empty};
use crate::db::Db;

pub async fn get_recent_connections(
    State(db): State<Db>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let limit = params
        .get("limit")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(15)
        .min(50);
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT connection_id, MAX(created_at) as last_connected_at FROM logs WHERE event = 'connect' GROUP BY connection_id ORDER BY last_connected_at DESC LIMIT ?",
    )
    .bind(limit)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut result = Vec::new();
    for (connection_id, last_connected_at) in rows {
        let row: Option<(String, String, String, i64, String, String, Option<String>)> =
            sqlx::query_as(
                "SELECT id, name, host, port, username, protocol, color_tag FROM connections WHERE id = ?",
            )
            .bind(&connection_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        if let Some((id, name, host, port, username, protocol, color_tag)) = row {
            let folder_name: Option<String> = sqlx::query_scalar(
                "SELECT name FROM folders WHERE id = (SELECT folder_id FROM connections WHERE id = ?)",
            )
            .bind(&id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            result.push(json!({
                "id": id,
                "name": name,
                "host": host,
                "port": port,
                "username": username,
                "protocol": protocol,
                "color_tag": color_tag,
                "folder_name": folder_name,
                "last_connected_at": last_connected_at,
            }));
        }
    }
    Ok(ok(result))
}

pub async fn cleanup_orphan_data(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let conn_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM connections")
        .fetch_all(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let valid_connections: HashSet<String> = conn_ids.into_iter().collect();
    let mut deleted = 0u64;

    let logs: Vec<i64> = sqlx::query_scalar("SELECT id FROM logs")
        .fetch_all(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    for id in logs {
        let conn: Option<String> =
            sqlx::query_scalar("SELECT connection_id FROM logs WHERE id = ?")
                .bind(id)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        if let Some(conn_id) = conn {
            if !valid_connections.contains(&conn_id) {
                let res = sqlx::query("DELETE FROM logs WHERE id = ?")
                    .bind(id)
                    .execute(&db.pool)
                    .await
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                deleted += res.rows_affected();
            }
        }
    }

    let history_rows: Vec<i64> = sqlx::query_scalar("SELECT id FROM history")
        .fetch_all(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    for id in history_rows {
        let conn: Option<String> =
            sqlx::query_scalar("SELECT connection_id FROM history WHERE id = ?")
                .bind(id)
                .fetch_optional(&db.pool)
                .await
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        if let Some(conn_id) = conn {
            if !valid_connections.contains(&conn_id) {
                let res = sqlx::query("DELETE FROM history WHERE id = ?")
                    .bind(id)
                    .execute(&db.pool)
                    .await
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
                deleted += res.rows_affected();
            }
        }
    }

    deleted +=
        delete_orphan_command_history_files(&db.paths.remote_history_dir, &valid_connections)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(ok(json!({ "deleted": deleted })))
}

pub async fn purge_all_data(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    for table in [
        "folders",
        "connections",
        "shortcuts",
        "ssh_keys",
        "history",
        "logs",
    ] {
        sqlx::query(&format!("DELETE FROM {}", table))
            .execute(&mut *tx)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    clear_all_remote_history(&db.paths.remote_history_dir)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    tx.commit()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    mark_local_dirty(&db).await?;
    Ok(ok_empty())
}
