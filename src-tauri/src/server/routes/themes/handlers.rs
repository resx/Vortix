use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::db::Db;
use crate::server::response::{ApiResponse, err, ok, ok_empty};
use crate::server::types::{CreateThemeDto, UpdateThemeDto};
use crate::time_utils::now_rfc3339;

type ThemeRow = (
    String,
    String,
    String,
    i64,
    String,
    String,
    String,
    Option<String>,
    String,
    String,
);

pub async fn get_themes(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Vec<Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows: Vec<ThemeRow> = sqlx::query_as(
        "SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes ORDER BY name ASC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result: Vec<Value> = rows
        .into_iter()
        .map(
            |(id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at)| {
                json!({
                    "id": id, "name": name, "mode": mode, "version": version, "author": author,
                    "terminal": serde_json::from_str::<Value>(&terminal).unwrap_or(Value::String(terminal)),
                    "highlights": serde_json::from_str::<Value>(&highlights).unwrap_or(Value::String(highlights)),
                    "ui": ui.and_then(|raw| serde_json::from_str::<Value>(&raw).ok()),
                    "created_at": created_at, "updated_at": updated_at,
                })
            },
        )
        .collect();
    Ok(ok(result))
}

pub async fn get_theme(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row: Option<ThemeRow> = sqlx::query_as(
        "SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some((id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at)) =
        row
    else {
        return Err(err(StatusCode::NOT_FOUND, "主题不存在"));
    };
    Ok(ok(json!({
        "id": id, "name": name, "mode": mode, "version": version, "author": author,
        "terminal": serde_json::from_str::<Value>(&terminal).unwrap_or(Value::String(terminal)),
        "highlights": serde_json::from_str::<Value>(&highlights).unwrap_or(Value::String(highlights)),
        "ui": ui.and_then(|raw| serde_json::from_str::<Value>(&raw).ok()),
        "created_at": created_at, "updated_at": updated_at,
    })))
}

pub async fn create_theme(
    State(db): State<Db>,
    Json(body): Json<CreateThemeDto>,
) -> Result<(StatusCode, Json<ApiResponse<Value>>), (StatusCode, Json<ApiResponse<Value>>)> {
    if body.name.trim().is_empty() || body.mode.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "缺少必填字段"));
    }
    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();
    let version = 1i64;
    let author = body.author.unwrap_or_default();
    let terminal = serde_json::to_string(&body.terminal)
        .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?;
    let highlights = serde_json::to_string(&body.highlights)
        .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?;
    let ui = body
        .ui
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?;

    sqlx::query(
        "INSERT INTO themes (id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&body.name)
    .bind(&body.mode)
    .bind(version)
    .bind(&author)
    .bind(&terminal)
    .bind(&highlights)
    .bind(ui)
    .bind(&now)
    .bind(&now)
    .execute(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((
        StatusCode::CREATED,
        ok(json!({
            "id": id, "name": body.name, "mode": body.mode, "version": version, "author": author,
            "terminal": body.terminal, "highlights": body.highlights, "ui": body.ui,
            "created_at": now, "updated_at": now,
        })),
    ))
}

pub async fn update_theme(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<UpdateThemeDto>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row: Option<ThemeRow> = sqlx::query_as(
        "SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some((id, name, mode, version, author, terminal, highlights, ui, created_at, _updated_at)) =
        row
    else {
        return Err(err(StatusCode::NOT_FOUND, "主题不存在"));
    };

    let name = body.name.unwrap_or(name);
    let mode = body.mode.unwrap_or(mode);
    let terminal_json = body
        .terminal
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?
        .unwrap_or(terminal);
    let highlights_json = body
        .highlights
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?
        .unwrap_or(highlights);
    let ui_json = if body.ui.is_some() {
        body.ui
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?
    } else {
        ui
    };
    let updated_at = now_rfc3339();

    sqlx::query("UPDATE themes SET name = ?, mode = ?, terminal = ?, highlights = ?, ui = ?, updated_at = ? WHERE id = ?")
        .bind(&name).bind(&mode).bind(&terminal_json).bind(&highlights_json).bind(&ui_json).bind(&updated_at).bind(&id)
        .execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let ui_value = body.ui.unwrap_or_else(|| {
        ui_json
            .as_ref()
            .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
            .unwrap_or(Value::Null)
    });
    Ok(ok(json!({
        "id": id, "name": name, "mode": mode, "version": version, "author": author,
        "terminal": body.terminal.unwrap_or_else(|| serde_json::from_str(&terminal_json).unwrap_or(Value::String(terminal_json.clone()))),
        "highlights": body.highlights.unwrap_or_else(|| serde_json::from_str(&highlights_json).unwrap_or(Value::String(highlights_json.clone()))),
        "ui": ui_value, "created_at": created_at, "updated_at": updated_at,
    })))
}

pub async fn delete_theme(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let result = sqlx::query("DELETE FROM themes WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(err(StatusCode::NOT_FOUND, "主题不存在"));
    }
    Ok(ok_empty())
}
