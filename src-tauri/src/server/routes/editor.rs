/* ── 外部编辑器 API ── */

use axum::{http::StatusCode, response::Json};
use serde::Deserialize;
use serde_json::{json, Value};
use std::process::Command;

use super::super::response::{ok, err, ApiResponse};

#[derive(Deserialize)]
pub struct EditorOpenDto {
    #[serde(rename = "editorType")]
    editor_type: String,
    #[serde(rename = "customCommand")]
    custom_command: Option<String>,
    #[serde(rename = "localPath")]
    local_path: Option<String>,
}

/// 获取编辑器启动命令
fn get_editor_command(editor_type: &str, file_path: &str, custom_command: Option<&str>) -> String {
    match editor_type {
        "system" => {
            if cfg!(target_os = "windows") {
                format!("start \"\" \"{}\"", file_path)
            } else {
                format!("xdg-open \"{}\"", file_path)
            }
        }
        "vscode" => format!("code \"{}\"", file_path),
        "notepad++" => format!("\"C:\\Program Files\\Notepad++\\notepad++.exe\" \"{}\"", file_path),
        "sublime" => {
            if cfg!(target_os = "windows") {
                format!("\"C:\\Program Files\\Sublime Text\\subl.exe\" \"{}\"", file_path)
            } else {
                format!("subl \"{}\"", file_path)
            }
        }
        "custom" => {
            custom_command
                .map(|cmd| cmd.replace("{file}", file_path))
                .unwrap_or_else(|| format!("start \"\" \"{}\"", file_path))
        }
        _ => format!("start \"\" \"{}\"", file_path),
    }
}

/// POST /api/editor/open — 启动外部编辑器
pub async fn open_editor(
    Json(body): Json<EditorOpenDto>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    if body.editor_type.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "缺少编辑器类型"));
    }
    if body.editor_type == "builtin" {
        return Err(err(StatusCode::BAD_REQUEST, "内置编辑器不需要调用此 API"));
    }

    let local_path = body.local_path.as_deref().unwrap_or("");
    if local_path.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "请先下载文件到本地"));
    }

    let cmd = get_editor_command(&body.editor_type, local_path, body.custom_command.as_deref());

    if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", &cmd]).spawn()
    } else {
        Command::new("sh").args(["-c", &cmd]).spawn()
    }
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, format!("启动编辑器失败: {}", e)))?;

    Ok(ok(json!({})))
}

/// GET /api/editor/temp-dir — 获取临时目录路径
pub async fn get_temp_dir() -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let dir = std::env::temp_dir().join("vortix-editor");
    std::fs::create_dir_all(&dir)
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(json!({ "path": dir.to_string_lossy() })))
}
