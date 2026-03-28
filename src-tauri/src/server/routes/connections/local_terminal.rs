use super::*;

pub(super) async fn get_local_terminal_default_working_dir(
    _db: State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let shell = body
        .get("shell")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if shell.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": "Shell 参数不能为空" })),
        ));
    }

    let shell_exe = match local_shell_executable(&shell) {
        Some(cmd) => cmd,
        None => {
            return Ok(Json(
                json!({ "success": false, "error": format!("不支持的 Shell 类型: {}", shell) }),
            ));
        }
    };

    let path = resolve_local_shell_working_dir(shell_exe, None).ok().flatten();
    Ok(Json(json!({
        "success": true,
        "path": path,
    })))
}

pub(super) async fn test_local_terminal(
    _db: State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let shell = body
        .get("shell")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if shell.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": "Shell 参数不能为空" })),
        ));
    }

    let shell_exe = match local_shell_executable(&shell) {
        Some(cmd) => cmd,
        None => {
            return Ok(Json(
                json!({ "success": false, "error": format!("不支持的 Shell 类型: {}", shell) }),
            ));
        }
    };

    let args: Vec<&str> = match shell.as_str() {
        "cmd" => vec!["/C", "exit", "0"],
        "bash" => vec!["-c", "exit 0"],
        "powershell" => vec!["-NoProfile", "-Command", "exit 0"],
        "powershell7" => vec!["-NoProfile", "-Command", "exit 0"],
        "wsl" => vec!["--", "echo", "ok"],
        "zsh" => vec!["-c", "exit 0"],
        "fish" => vec!["-c", "exit 0"],
        _ => vec!["-c", "exit 0"],
    };

    let requested_working_dir = body
        .get("workingDir")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let working_dir = match resolve_local_shell_working_dir(shell_exe, requested_working_dir) {
        Ok(dir) => dir,
        Err(e) => return Ok(Json(json!({ "success": false, "error": e }))),
    };

    let mut command = Command::new(shell_exe);
    command.args(args);
    if let Some(dir) = &working_dir {
        command.current_dir(dir);
    }

    let mut child = match command.spawn() {
        Ok(c) => c,
        Err(e) => {
            return Ok(Json(
                json!({ "success": false, "error": format!("启动 {} 失败: {}", shell, e) }),
            ));
        }
    };

    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let code = status.code();
                if status.success() || (shell == "wsl" && code.is_some()) {
                    return Ok(Json(json!({ "success": true, "message": "连接成功" })));
                }
                return Ok(Json(
                    json!({ "success": false, "error": format!("Shell 退出状态异常: {:?}", code) }),
                ));
            }
            Ok(None) => {
                if Instant::now() > deadline {
                    let _ = child.kill();
                    return Ok(Json(json!({ "success": false, "error": "连接超时(10s)" })));
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Ok(Json(json!({ "success": false, "error": e.to_string() }))),
        }
    }
}
