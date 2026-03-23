/* ── 主题 CRUD + 导入/导出 ── */

use axum::body::Bytes;
use axum::{
    extract::State,
    http::{StatusCode, header},
    response::Json,
    response::Response as AxumResponse,
};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::super::response::{ApiResponse, err, ok, ok_empty};
use super::super::types::*;
use crate::db::Db;
use crate::time_utils::now_rfc3339;

/* ── 辅助函数 ── */

fn default_highlights() -> Map<String, Value> {
    let mut map = Map::new();
    for (k, v) in [
        ("error", "#F44747"),
        ("warning", "#E6A23C"),
        ("ok", "#6A9955"),
        ("info", "#569CD6"),
        ("debug", "#808080"),
        ("ipMac", "#CE9178"),
        ("path", "#4EC9B0"),
        ("url", "#569CD6"),
        ("timestamp", "#DCDCAA"),
        ("env", "#C586C0"),
    ] {
        map.insert(k.to_string(), Value::String(v.to_string()));
    }
    map
}

fn is_dark(hex: &str) -> bool {
    let h = hex.trim_start_matches('#');
    if h.len() < 6 {
        return true;
    }
    let r = u8::from_str_radix(&h[0..2], 16).unwrap_or(0) as f64;
    let g = u8::from_str_radix(&h[2..4], 16).unwrap_or(0) as f64;
    let b = u8::from_str_radix(&h[4..6], 16).unwrap_or(0) as f64;
    (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0 < 0.5
}

fn get_str(value: Option<&Value>) -> Option<String> {
    value.and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn merge_highlights(custom: Option<&Value>) -> Value {
    let mut base = default_highlights();
    if let Some(Value::Object(map)) = custom {
        for (k, v) in map {
            base.insert(k.clone(), v.clone());
        }
    }
    Value::Object(base)
}

fn sanitize_theme_filename(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        "theme".to_string()
    } else {
        out
    }
}

fn detect_theme_format(data: &Value) -> String {
    if let Some(obj) = data.as_object() {
        if obj.get("format").and_then(|v| v.as_str()) == Some("vortix-theme-v1") {
            return "vortix".to_string();
        }
        if obj.get("schemes").and_then(|v| v.as_array()).is_some() {
            return "windows-terminal".to_string();
        }
        if obj.get("background").and_then(|v| v.as_str()).is_some()
            && obj.get("foreground").and_then(|v| v.as_str()).is_some()
            && obj.get("name").and_then(|v| v.as_str()).is_some()
        {
            return "windows-terminal".to_string();
        }
        if obj.get("Ansi 0 Color").is_some() || obj.get("Background Color").is_some() {
            return "iterm2".to_string();
        }
    }
    "unknown".to_string()
}

fn parse_vortix_theme(data: &Value) -> ThemeImportResult {
    let errors = Vec::new();
    let Some(obj) = data.as_object() else {
        return ThemeImportResult {
            format: "vortix".to_string(),
            themes: Vec::new(),
            errors: vec!["缺少 theme 字段".to_string()],
        };
    };
    let Some(theme_val) = obj.get("theme") else {
        return ThemeImportResult {
            format: "vortix".to_string(),
            themes: Vec::new(),
            errors: vec!["缺少 theme 字段".to_string()],
        };
    };
    let empty = Map::new();
    let theme = theme_val.as_object().unwrap_or(&empty);
    let name = theme
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Imported Theme")
        .to_string();
    let mode = theme
        .get("mode")
        .and_then(|v| v.as_str())
        .unwrap_or("dark")
        .to_string();
    let author = theme
        .get("author")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let terminal = theme
        .get("terminal")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));
    let highlights = merge_highlights(theme.get("highlights"));
    let ui = theme.get("ui").cloned();
    ThemeImportResult {
        format: "vortix".to_string(),
        themes: vec![ThemeImportItem {
            name,
            mode,
            version: 1,
            author,
            terminal,
            highlights,
            ui,
        }],
        errors,
    }
}

fn parse_windows_terminal(data: &Value) -> ThemeImportResult {
    let errors = Vec::new();
    let mut schemes: Vec<Value> = Vec::new();
    if let Some(obj) = data.as_object() {
        if let Some(arr) = obj.get("schemes").and_then(|v| v.as_array()) {
            schemes.extend(arr.iter().cloned());
        }
    }
    if schemes.is_empty() {
        schemes.push(data.clone());
    }

    let themes = schemes
        .into_iter()
        .filter_map(|scheme| {
            let obj = scheme.as_object()?;
            let bg = get_str(obj.get("background")).unwrap_or("#0C0C0C".to_string());
            let fg = get_str(obj.get("foreground")).unwrap_or("#CCCCCC".to_string());
            let cursor = get_str(obj.get("cursorColor")).unwrap_or_else(|| fg.clone());
            let mut t = Map::new();
            t.insert("background".to_string(), Value::String(bg.clone()));
            t.insert("foreground".to_string(), Value::String(fg));
            t.insert("cursor".to_string(), Value::String(cursor));
            if let Some(v) = get_str(obj.get("selectionBackground")) {
                t.insert("selectionBackground".to_string(), Value::String(v));
            }
            for (json_key, term_key) in [
                ("black", "black"),
                ("red", "red"),
                ("green", "green"),
                ("yellow", "yellow"),
                ("blue", "blue"),
                ("cyan", "cyan"),
                ("white", "white"),
                ("brightBlack", "brightBlack"),
                ("brightRed", "brightRed"),
                ("brightGreen", "brightGreen"),
                ("brightYellow", "brightYellow"),
                ("brightBlue", "brightBlue"),
                ("brightCyan", "brightCyan"),
                ("brightWhite", "brightWhite"),
            ] {
                if let Some(v) = get_str(obj.get(json_key)) {
                    t.insert(term_key.to_string(), Value::String(v));
                }
            }
            if let Some(v) = get_str(obj.get("purple")).or_else(|| get_str(obj.get("magenta"))) {
                t.insert("magenta".to_string(), Value::String(v));
            }
            if let Some(v) =
                get_str(obj.get("brightPurple")).or_else(|| get_str(obj.get("brightMagenta")))
            {
                t.insert("brightMagenta".to_string(), Value::String(v));
            }
            Some(ThemeImportItem {
                name: get_str(obj.get("name")).unwrap_or("Windows Terminal Theme".to_string()),
                mode: if is_dark(&bg) {
                    "dark".to_string()
                } else {
                    "light".to_string()
                },
                version: 1,
                author: "".to_string(),
                terminal: Value::Object(t),
                highlights: Value::Object(default_highlights()),
                ui: None,
            })
        })
        .collect();
    ThemeImportResult {
        format: "windows-terminal".to_string(),
        themes,
        errors,
    }
}

fn iterm_color_to_hex(obj: &Value) -> Option<String> {
    let o = obj.as_object()?;
    let r = (o
        .get("Red Component")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
        * 255.0)
        .round()
        .clamp(0.0, 255.0) as u8;
    let g = (o
        .get("Green Component")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
        * 255.0)
        .round()
        .clamp(0.0, 255.0) as u8;
    let b = (o
        .get("Blue Component")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0)
        * 255.0)
        .round()
        .clamp(0.0, 255.0) as u8;
    Some(format!("#{:02x}{:02x}{:02x}", r, g, b))
}

fn parse_iterm2(data: &Value) -> ThemeImportResult {
    let errors = Vec::new();
    let mut terminal = Map::new();
    let bg = data
        .get("Background Color")
        .and_then(iterm_color_to_hex)
        .unwrap_or("#000000".to_string());
    let fg = data
        .get("Foreground Color")
        .and_then(iterm_color_to_hex)
        .unwrap_or("#FFFFFF".to_string());
    terminal.insert("background".to_string(), Value::String(bg.clone()));
    terminal.insert("foreground".to_string(), Value::String(fg));
    if let Some(v) = data.get("Cursor Color").and_then(iterm_color_to_hex) {
        terminal.insert("cursor".to_string(), Value::String(v));
    }
    if let Some(v) = data.get("Selection Color").and_then(iterm_color_to_hex) {
        terminal.insert("selectionBackground".to_string(), Value::String(v));
    }
    for (iterm_key, term_key) in [
        ("Ansi 0 Color", "black"),
        ("Ansi 1 Color", "red"),
        ("Ansi 2 Color", "green"),
        ("Ansi 3 Color", "yellow"),
        ("Ansi 4 Color", "blue"),
        ("Ansi 5 Color", "magenta"),
        ("Ansi 6 Color", "cyan"),
        ("Ansi 7 Color", "white"),
        ("Ansi 8 Color", "brightBlack"),
        ("Ansi 9 Color", "brightRed"),
        ("Ansi 10 Color", "brightGreen"),
        ("Ansi 11 Color", "brightYellow"),
        ("Ansi 12 Color", "brightBlue"),
        ("Ansi 13 Color", "brightMagenta"),
        ("Ansi 14 Color", "brightCyan"),
        ("Ansi 15 Color", "brightWhite"),
    ] {
        if let Some(v) = data.get(iterm_key).and_then(iterm_color_to_hex) {
            terminal.insert(term_key.to_string(), Value::String(v));
        }
    }
    ThemeImportResult {
        format: "iterm2".to_string(),
        themes: vec![ThemeImportItem {
            name: "iTerm2 Theme".to_string(),
            mode: if is_dark(&bg) {
                "dark".to_string()
            } else {
                "light".to_string()
            },
            version: 1,
            author: "".to_string(),
            terminal: Value::Object(terminal),
            highlights: Value::Object(default_highlights()),
            ui: None,
        }],
        errors,
    }
}

fn import_theme_raw(raw: &str) -> ThemeImportResult {
    let parsed: Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(e) => {
            return ThemeImportResult {
                format: "unknown".to_string(),
                themes: Vec::new(),
                errors: vec![format!("JSON 解析失败: {}", e)],
            };
        }
    };
    match detect_theme_format(&parsed).as_str() {
        "vortix" => parse_vortix_theme(&parsed),
        "windows-terminal" => parse_windows_terminal(&parsed),
        "iterm2" => parse_iterm2(&parsed),
        _ => ThemeImportResult {
            format: "unknown".to_string(),
            themes: Vec::new(),
            errors: vec!["无法识别的主题格式".to_string()],
        },
    }
}

/* ── 路由处理器 ── */

pub async fn get_themes(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Vec<Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows: Vec<(String, String, String, i64, String, String, String, Option<String>, String, String)> = sqlx::query_as(
        "SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes ORDER BY name ASC",
    ).fetch_all(&db.pool).await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result: Vec<Value> = rows.into_iter().map(|(id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at)| {
        json!({
            "id": id, "name": name, "mode": mode, "version": version, "author": author,
            "terminal": serde_json::from_str::<Value>(&terminal).unwrap_or(Value::String(terminal)),
            "highlights": serde_json::from_str::<Value>(&highlights).unwrap_or(Value::String(highlights)),
            "ui": ui.and_then(|raw| serde_json::from_str::<Value>(&raw).ok()),
            "created_at": created_at, "updated_at": updated_at,
        })
    }).collect();
    Ok(ok(result))
}

pub async fn get_theme(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row: Option<(String, String, String, i64, String, String, String, Option<String>, String, String)> = sqlx::query_as(
        "SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes WHERE id = ?",
    ).bind(&id).fetch_optional(&db.pool).await
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
    ).bind(&id).bind(&body.name).bind(&body.mode).bind(version).bind(&author)
    .bind(&terminal).bind(&highlights).bind(ui).bind(&now).bind(&now)
    .execute(&db.pool).await
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
    let row: Option<(String, String, String, i64, String, String, String, Option<String>, String, String)> = sqlx::query_as(
        "SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes WHERE id = ?",
    ).bind(&id).fetch_optional(&db.pool).await
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
    Ok(ok(
        json!({ "format": format, "themes": created, "errors": errors }),
    ))
}

pub async fn export_theme(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<AxumResponse, (StatusCode, Json<ApiResponse<Value>>)> {
    let row: Option<(String, String, String, i64, String, String, String, Option<String>, String, String)> = sqlx::query_as(
        "SELECT id, name, mode, version, author, terminal, highlights, ui, created_at, updated_at FROM themes WHERE id = ?",
    ).bind(&id).fetch_optional(&db.pool).await
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
