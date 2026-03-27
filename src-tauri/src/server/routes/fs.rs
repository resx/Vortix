/* ── 文件系统操作 ── */

use axum::body::Bytes;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::fs;
use std::io::Read as IoRead;
use std::path::PathBuf;
use std::time::SystemTime;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

use super::super::response::{ApiResponse, err, ok};
use super::super::types::*;
use crate::db::Db;

fn format_modified_time(system_time: Option<SystemTime>) -> String {
    match system_time {
        Some(value) => {
            let datetime: chrono::DateTime<chrono::Local> = value.into();
            datetime.format("%Y-%m-%d %H:%M").to_string()
        }
        None => "-".to_string(),
    }
}

pub async fn list_dirs(
    State(_db): State<Db>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let raw_path = params.get("path").cloned().unwrap_or_default();
    let home = dirs::home_dir()
        .ok_or_else(|| err(StatusCode::INTERNAL_SERVER_ERROR, "无法获取用户目录"))?;
    let base = if raw_path.trim().is_empty() {
        home.clone()
    } else {
        PathBuf::from(raw_path)
    };
    let base = base
        .canonicalize()
        .map_err(|e| err(StatusCode::BAD_REQUEST, format!("无法读取目录: {}", e)))?;
    if !base.starts_with(&home) {
        return Err(err(StatusCode::FORBIDDEN, "禁止访问用户主目录之外的路径"));
    }
    let mut dirs = Vec::new();
    if let Ok(entries) = fs::read_dir(&base) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with('.') || name.starts_with('$') {
                        continue;
                    }
                    dirs.push(name);
                }
            }
        }
    }
    dirs.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
    Ok(ok(json!({ "path": base.to_string_lossy(), "dirs": dirs })))
}

pub async fn list_local_entries(
    State(_db): State<Db>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let raw_path = params
        .get("path")
        .cloned()
        .or_else(|| dirs::home_dir().map(|p| p.to_string_lossy().to_string()))
        .unwrap_or_default();
    let base = PathBuf::from(raw_path);
    let base = base
        .canonicalize()
        .map_err(|e| err(StatusCode::BAD_REQUEST, format!("无法读取目录: {}", e)))?;
    if !base.is_dir() {
        return Err(err(StatusCode::BAD_REQUEST, "目标路径不是目录"));
    }

    let mut entries = Vec::new();
    let iterator = fs::read_dir(&base)
        .map_err(|e| err(StatusCode::BAD_REQUEST, format!("无法列出目录: {}", e)))?;

    for item in iterator.flatten() {
        let path = item.path();
        let Ok(metadata) = item.metadata() else {
            continue;
        };
        let file_type = if metadata.is_dir() {
            "dir"
        } else if metadata.is_file() {
            "file"
        } else {
            "other"
        };
        let modified_at = format_modified_time(metadata.modified().ok());
        let name = item.file_name().to_string_lossy().to_string();
        entries.push(json!({
            "name": name,
            "path": path.to_string_lossy(),
            "type": file_type,
            "size": if metadata.is_file() { metadata.len() as i64 } else { -1 },
            "modifiedAt": modified_at,
            "permissions": "-",
            "owner": "-",
            "group": "-",
        }));
    }

    entries.sort_by(|a, b| {
        let a_type = a.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let b_type = b.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if a_type == "dir" && b_type != "dir" {
            return std::cmp::Ordering::Less;
        }
        if a_type != "dir" && b_type == "dir" {
            return std::cmp::Ordering::Greater;
        }
        let a_name = a.get("name").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
        let b_name = b.get("name").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
        a_name.cmp(&b_name)
    });

    Ok(ok(json!({
        "path": base.to_string_lossy(),
        "entries": entries
    })))
}

pub async fn pick_dir(
    State(db): State<Db>,
    Json(body): Json<PickDirBody>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let mut builder = db.app_handle.dialog().file();
    if let Some(dir) = body.initialDir {
        builder = builder.set_directory(dir);
    }
    let path = builder
        .blocking_pick_folder()
        .and_then(|p| p.into_path().ok());
    Ok(ok(
        json!({ "path": path.map(|p| p.to_string_lossy().to_string()) }),
    ))
}

pub async fn pick_file(
    State(db): State<Db>,
    Json(body): Json<PickFileBody>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let mut builder = db.app_handle.dialog().file();
    if let Some(title) = body.title {
        builder = builder.set_title(title);
    }
    if let Some(filters) = body.filters {
        let parts: Vec<&str> = filters.split('|').collect();
        let mut i = 0;
        while i + 1 < parts.len() {
            let name = parts[i];
            let exts = parts[i + 1]
                .split(';')
                .filter_map(|v| v.trim().strip_prefix("*."))
                .map(|v| v.to_string())
                .collect::<Vec<String>>();
            if !exts.is_empty() {
                let exts_ref: Vec<&str> = exts.iter().map(|s| s.as_str()).collect();
                builder = builder.add_filter(name, &exts_ref);
            }
            i += 2;
        }
    }
    let path = builder.blocking_pick_file();
    if let Some(path) = path {
        let path = path
            .into_path()
            .map_err(|_| err(StatusCode::INTERNAL_SERVER_ERROR, "无法读取文件路径"))?;
        let mut content = String::new();
        std::fs::File::open(&path)
            .and_then(|mut f| f.read_to_string(&mut content))
            .map_err(|e| {
                err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("无法读取文件: {}", e),
                )
            })?;
        Ok(ok(
            json!({ "path": path.to_string_lossy(), "content": content }),
        ))
    } else {
        Ok(ok(json!({ "path": Value::Null, "content": Value::Null })))
    }
}

pub async fn save_download(
    State(db): State<Db>,
    headers: axum::http::HeaderMap,
    body: Bytes,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let file_name = headers
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if file_name.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "缺少文件名"));
    }
    let target_dir = headers
        .get("x-target-dir")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let base_dir = if target_dir.is_empty() {
        db.app_handle
            .path()
            .download_dir()
            .unwrap_or_else(|_| std::env::temp_dir())
            .join("vortix-download")
    } else {
        PathBuf::from(target_dir)
    };
    fs::create_dir_all(&base_dir)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let file_path = base_dir.join(file_name);
    fs::write(&file_path, &body)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(json!({ "path": file_path.to_string_lossy() })))
}

pub async fn open_local(
    State(_db): State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let path = body.get("path").and_then(|v| v.as_str()).unwrap_or("");
    if path.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "缺少文件路径"));
    }
    open::that(path).map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(super::super::response::ok_empty())
}

pub async fn pick_save_path(
    State(db): State<Db>,
    Json(body): Json<PickSavePathBody>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let mut builder = db.app_handle.dialog().file();
    if let Some(filters) = body.filters {
        let parts: Vec<&str> = filters.split('|').collect();
        let mut i = 0;
        while i + 1 < parts.len() {
            let name = parts[i];
            let exts = parts[i + 1]
                .split(';')
                .filter_map(|v| v.trim().strip_prefix("*."))
                .map(|v| v.to_string())
                .collect::<Vec<String>>();
            if !exts.is_empty() {
                let exts_ref: Vec<&str> = exts.iter().map(|s| s.as_str()).collect();
                builder = builder.add_filter(name, &exts_ref);
            }
            i += 2;
        }
    }
    if let Some(name) = body.fileName {
        builder = builder.set_file_name(name);
    }
    let path = builder
        .blocking_save_file()
        .and_then(|p| p.into_path().ok());
    Ok(ok(
        json!({ "path": path.map(|p| p.to_string_lossy().to_string()) }),
    ))
}
