use axum::body::Bytes;
use axum::{
    extract::State,
    http::{StatusCode, header},
    response::Json,
    response::Response as AxumResponse,
};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::db::Db;
use crate::server::response::{ApiResponse, err, ok};
use crate::server::types::ThemeImportResult;
use crate::time_utils::now_rfc3339;

use super::helpers::sanitize_theme_filename;
use super::parser::import_theme_raw;

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

pub async fn import_theme(
    State(db): State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let raw = body.get("raw").and_then(|v| v.as_str()).unwrap_or("");
    if raw.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "缺少 raw 字段"));
    }
    let result = import_theme_raw(raw);
    if result.themes.is_empty() {
        let msg = if result.errors.is_empty() {
            "未解析到主题".to_string()
        } else {
            result.errors.join("; ")
        };
        return Err(err(StatusCode::BAD_REQUEST, msg));
    }

    let ThemeImportResult {
        format,
        themes,
        errors,
    } = result;
    let mut created: Vec<Value> = Vec::new();
    for item in themes {
        let id = Uuid::new_v4().to_string();
        let now = now_rfc3339();
        let terminal_json = serde_json::to_string(&item.terminal)
            .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?;
        let highlights_json = serde_json::to_string(&item.highlights)
            .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?;
        let ui_json = item
            .ui
            .as_ref()
            .map(serde_json::to_string)
            .transpose()
            .map_err(|e| err(StatusCode::BAD_REQUEST, e.to_string()))?;

        sqlx::query(
            "INSERT INTO themes (id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(&id).bind(&item.name).bind(&item.mode).bind(item.version).bind(&item.author)
        .bind(&terminal_json).bind(&highlights_json).bind(&ui_json).bind(&now).bind(&now)
        .execute(&db.pool).await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        created.push(json!({
            "id": id, "name": item.name, "mode": item.mode, "version": item.version,
            "author": item.author, "terminal": item.terminal, "highlights": item.highlights,
            "ui": item.ui, "created_at": now, "updated_at": now,
        }));
    }
    Ok(ok(json!({ "format": format, "themes": created, "errors": errors })))
}

pub async fn export_theme(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<AxumResponse, (StatusCode, Json<ApiResponse<Value>>)> {
    let row: Option<ThemeRow> = sqlx::query_as(
        "SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some((id, name, mode, version, author, terminal, highlights, ui, _created_at, _updated_at)) =
        row
    else {
        return Err(err(StatusCode::NOT_FOUND, "主题不存在"));
    };

    let payload = json!({
        "format": "vortix-theme-v1",
        "theme": {
            "id": id, "name": name, "mode": mode, "version": version, "author": author,
            "terminal": serde_json::from_str::<Value>(&terminal).unwrap_or(Value::String(terminal)),
            "highlights": serde_json::from_str::<Value>(&highlights).unwrap_or(Value::String(highlights)),
            "ui": ui.and_then(|raw| serde_json::from_str::<Value>(&raw).ok()),
        }
    });

    let json_text = serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string());
    let mut resp = AxumResponse::new(Bytes::from(json_text).into());
    *resp.status_mut() = StatusCode::OK;
    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        header::HeaderValue::from_static("application/json"),
    );
    let filename = format!(
        "{}.vortix-theme.json",
        sanitize_theme_filename(payload["theme"]["name"].as_str().unwrap_or("theme"))
    );
    resp.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        header::HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename)).unwrap(),
    );
    Ok(resp)
}
