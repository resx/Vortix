use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use serde_json::{Value, json};
use std::collections::HashMap;

use super::super::remote_history::{
    CommandHistoryEntry, append_command_history, clear_command_history,
    load_command_history_entries, write_command_history_snapshot,
};
use super::super::response::{ApiResponse, err, ok};
use crate::db::Db;
use crate::time_utils::now_rfc3339;

pub async fn get_history(
    State(db): State<Db>,
    axum::extract::Path(connection_id): axum::extract::Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Vec<Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let limit = params
        .get("limit")
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(100)
        .min(1000);
    let suggest_mode = params
        .get("suggest")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let query = params
        .get("q")
        .map(|v| v.trim().to_string())
        .unwrap_or_default();

    if suggest_mode {
        let entries = query_history_suggestions(&db, &connection_id, &query, limit).await?;
        let result = entries.into_iter().map(history_entry_to_value).collect();
        return Ok(ok(result));
    }

    let entries = match load_command_history_entries(&db.paths.remote_history_dir, &connection_id)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?
    {
        Some(entries) => entries,
        None => backfill_command_history(&db, &connection_id).await?,
    };

    let result = entries
        .into_iter()
        .rev()
        .take(limit)
        .map(history_entry_to_value)
        .collect();
    Ok(ok(result))
}

async fn query_history_suggestions(
    db: &Db,
    connection_id: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<CommandHistoryEntry>, (StatusCode, Json<ApiResponse<Value>>)> {
    const RECENT_WINDOW: i64 = 5000;
    let pattern = if query.is_empty() {
        "%".to_string()
    } else {
        format!("%{}%", query.to_lowercase())
    };

    let rows: Vec<(i64, String, String, String)> = sqlx::query_as(
        "WITH recent AS (
           SELECT id, connection_id, command, executed_at,
                  ROW_NUMBER() OVER (ORDER BY id DESC) AS recency_rank
           FROM history
           WHERE connection_id = ?
           ORDER BY id DESC
           LIMIT ?
         ),
         dedup AS (
           SELECT command,
                  MAX(id) AS latest_id,
                  MIN(recency_rank) AS best_recency_rank,
                  COUNT(*) AS freq
           FROM recent
           WHERE LOWER(command) LIKE ?
           GROUP BY command
         ),
         ranked AS (
           SELECT h.id, h.connection_id, h.command, h.executed_at,
                  (
                    CASE
                      WHEN d.best_recency_rank <= 20 THEN 100
                      WHEN d.best_recency_rank <= 100 THEN 60
                      WHEN d.best_recency_rank <= 500 THEN 30
                      ELSE 10
                    END
                  ) + (MIN(d.freq, 20) * 3) AS score
           FROM dedup d
           JOIN history h ON h.id = d.latest_id
         )
         SELECT id, connection_id, command, executed_at
         FROM ranked
         ORDER BY score DESC, id DESC
         LIMIT ?",
    )
    .bind(connection_id)
    .bind(RECENT_WINDOW)
    .bind(pattern)
    .bind(limit as i64)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(rows
        .into_iter()
        .map(
            |(id, connection_id, command, executed_at)| CommandHistoryEntry {
                id,
                connection_id,
                command,
                executed_at,
            },
        )
        .collect())
}

pub async fn add_history(
    State(db): State<Db>,
    Json(body): Json<Value>,
) -> Result<(StatusCode, Json<ApiResponse<Value>>), (StatusCode, Json<ApiResponse<Value>>)> {
    let connection_id = body
        .get("connection_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let command = body.get("command").and_then(|v| v.as_str()).unwrap_or("");
    if connection_id.is_empty() || command.is_empty() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "连接 ID 和命令不能为空",
        ));
    }

    let executed_at = now_rfc3339();
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let result =
        sqlx::query("INSERT INTO history (connection_id, command, executed_at) VALUES (?, ?, ?)")
            .bind(connection_id)
            .bind(command)
            .bind(&executed_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let entry = CommandHistoryEntry {
        id: result.last_insert_rowid(),
        connection_id: connection_id.to_string(),
        command: command.to_string(),
        executed_at: executed_at.clone(),
    };
    append_command_history(&db.paths.remote_history_dir, &entry)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    tx.commit()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, ok(history_entry_to_value(entry))))
}

pub async fn clear_history(
    State(db): State<Db>,
    axum::extract::Path(connection_id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let mut tx = db
        .pool
        .begin()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let result = sqlx::query("DELETE FROM history WHERE connection_id = ?")
        .bind(&connection_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    clear_command_history(&db.paths.remote_history_dir, &connection_id)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    tx.commit()
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(ok(json!({ "deleted": result.rows_affected() })))
}

async fn backfill_command_history(
    db: &Db,
    connection_id: &str,
) -> Result<Vec<CommandHistoryEntry>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows: Vec<(i64, String, String, String)> = sqlx::query_as(
        "SELECT id, connection_id, command, executed_at FROM history WHERE connection_id = ? ORDER BY id ASC",
    )
    .bind(connection_id)
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let entries = rows
        .into_iter()
        .map(
            |(id, connection_id, command, executed_at)| CommandHistoryEntry {
                id,
                connection_id,
                command,
                executed_at,
            },
        )
        .collect::<Vec<_>>();
    write_command_history_snapshot(&db.paths.remote_history_dir, connection_id, &entries)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(entries)
}

fn history_entry_to_value(entry: CommandHistoryEntry) -> Value {
    json!({
        "id": entry.id,
        "connection_id": entry.connection_id,
        "command": entry.command,
        "executed_at": entry.executed_at,
    })
}
