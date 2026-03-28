use super::*;

#[allow(dead_code)]
pub(super) async fn test_ssh_connection(
    State(db): State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    #[derive(Clone, Default)]
    struct TestClientHandler;
    impl Handler for TestClientHandler {
        type Error = russh::Error;
        async fn check_server_key(
            &mut self,
            _key: &russh::keys::ssh_key::PublicKey,
        ) -> Result<bool, Self::Error> {
            Ok(true)
        }
    }

    let host = body
        .get("host")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let username = body
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if host.is_empty() || username.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": "连接参数不完整" })),
        ));
    }
    let port = body.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let mut resolved_username = username;
    let mut resolved_password = body
        .get("password")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let private_key = body
        .get("privateKey")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let passphrase = body
        .get("passphrase")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if let Some(preset_id) = body.get("preset_id").and_then(|v| v.as_str()) {
        if let Ok(Some(row)) = sqlx::query_as::<_, PresetRow>(
            "SELECT id, name, username, encrypted_password, remark, created_at, updated_at FROM presets WHERE id = ?",
        ).bind(preset_id).fetch_optional(&db.pool).await {
            resolved_username = row.username;
            let pwd = db.crypto.decrypt(&row.encrypted_password).unwrap_or_default();
            resolved_password = if pwd.is_empty() { None } else { Some(pwd) };
        }
    }

    let result = time::timeout(Duration::from_secs(10), async move {
        let config = Arc::new(client::Config::default());
        let addr = format!("{host}:{port}");
        let mut session = client::connect(config, addr, TestClientHandler)
            .await
            .map_err(|e| format!("连接失败: {e}"))?;

        if let Some(pk) = private_key.as_deref() {
            let key_pair = keys::decode_secret_key(pk, passphrase.as_deref())
                .map_err(|e| format!("私钥解析失败: {e}"))?;
            let auth_res = session
                .authenticate_publickey(
                    &resolved_username,
                    PrivateKeyWithHashAlg::new(
                        Arc::new(key_pair),
                        session
                            .best_supported_rsa_hash()
                            .await
                            .map_err(|e| e.to_string())?
                            .flatten(),
                    ),
                )
                .await
                .map_err(|e| format!("认证失败: {e}"))?;
            if !auth_res.success() {
                return Err("认证失败".to_string());
            }
        } else if let Some(pwd) = resolved_password.as_deref() {
            let auth_res = session
                .authenticate_password(&resolved_username, pwd)
                .await
                .map_err(|e| format!("认证失败: {e}"))?;
            if !auth_res.success() {
                return Err("认证失败".to_string());
            }
        } else {
            return Err("缺少认证方式".to_string());
        }

        let _ = session
            .disconnect(russh::Disconnect::ByApplication, "", "en")
            .await;
        Ok::<(), String>(())
    })
    .await;

    match result {
        Err(_) => Ok(Json(json!({ "success": false, "error": "连接超时(10s)" }))),
        Ok(Err(e)) => {
            let error = if e.to_ascii_lowercase().contains("the key is encrypted") {
                format_private_key_parse_error("The key is encrypted", false)
            } else {
                e
            };
            Ok(Json(json!({ "success": false, "error": error })))
        }
        Ok(Ok(())) => Ok(Json(json!({ "success": true, "message": "连接成功" }))),
    }
}

pub(super) async fn test_ssh_connection_secure(
    State(db): State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    #[derive(Debug)]
    enum TestConnectionError {
        Message(String),
    }

    #[derive(Clone, Default)]
    struct TestClientHandler;

    impl Handler for TestClientHandler {
        type Error = russh::Error;

        async fn check_server_key(
            &mut self,
            _key: &russh::keys::ssh_key::PublicKey,
        ) -> Result<bool, Self::Error> {
            Ok(true)
        }
    }

    let host = body
        .get("host")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let username = body
        .get("username")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if host.is_empty() || username.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "success": false,
                "error": "Connection parameters are incomplete."
            })),
        ));
    }

    let port = body.get("port").and_then(|v| v.as_u64()).unwrap_or(22) as u16;
    let mut resolved_username = username;
    let mut resolved_password = body
        .get("password")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let private_key = body
        .get("privateKey")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let passphrase = body
        .get("passphrase")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let jump = resolve_jump_host_config_by_id(
        &db,
        body.get("jump_server_id").and_then(|v| v.as_str()),
        None,
    )
    .await
    .map_err(|(status, payload)| {
        let message = payload
            .0
            .error
            .unwrap_or_else(|| "Failed to resolve jump host.".to_string());
        (status, Json(json!({ "success": false, "error": message })))
    })?;
    if body
        .get("jump_server_id")
        .and_then(|v| v.as_str())
        .is_some()
        && jump.is_none()
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "success": false,
                "error": "Jump host connection not found."
            })),
        ));
    }

    if let Some(preset_id) = body.get("preset_id").and_then(|v| v.as_str()) {
        if let Ok(Some(row)) = sqlx::query_as::<_, PresetRow>(
            "SELECT id, name, username, encrypted_password, remark, created_at, updated_at FROM presets WHERE id = ?",
        ).bind(preset_id).fetch_optional(&db.pool).await {
            resolved_username = row.username;
            let pwd = db.crypto.decrypt(&row.encrypted_password).unwrap_or_default();
            resolved_password = if pwd.is_empty() { None } else { Some(pwd) };
        }
    }

    let target_auth = RusshAuthConfig {
        password: resolved_password,
        private_key,
        passphrase,
    };

    let result = time::timeout(Duration::from_secs(10), async move {
        let config = Arc::new(client::Config::default());
        let mut jump_session: Option<client::Handle<TestClientHandler>> = None;

        let mut session = if let Some(jump_config) = jump {
            let jump_addr = format!(
                "{}:{}",
                jump_config.endpoint.host, jump_config.endpoint.port
            );
            let mut jump_handle = client::connect(config.clone(), jump_addr, TestClientHandler)
                .await
                .map_err(|e| {
                    TestConnectionError::Message(format!("Jump connection failed: {e}"))
                })?;

            authenticate_russh_handle(
                &mut jump_handle,
                &jump_config.endpoint.username,
                &jump_config.auth,
            )
            .await
            .map_err(TestConnectionError::Message)?;

            let stream = jump_handle
                .channel_open_direct_tcpip(&host, port as u32, "127.0.0.1", 0)
                .await
                .map_err(|e| {
                    TestConnectionError::Message(format!("Failed to open jump tunnel: {e}"))
                })?
                .into_stream();

            let target_handle = client::connect_stream(config.clone(), stream, TestClientHandler)
                .await
                .map_err(|e| {
                    TestConnectionError::Message(format!("Target connection failed: {e}"))
                })?;

            jump_session = Some(jump_handle);
            target_handle
        } else {
            let addr = format!("{host}:{port}");
            client::connect(config, addr, TestClientHandler)
                .await
                .map_err(|e| TestConnectionError::Message(format!("Connection failed: {e}")))?
        };

        authenticate_russh_handle(&mut session, &resolved_username, &target_auth)
            .await
            .map_err(TestConnectionError::Message)?;

        let _ = session
            .disconnect(russh::Disconnect::ByApplication, "", "en")
            .await;
        if let Some(handle) = jump_session {
            let _ = handle
                .disconnect(russh::Disconnect::ByApplication, "", "en")
                .await;
        }
        Ok::<(), TestConnectionError>(())
    })
    .await;

    match result {
        Err(_) => Ok(Json(
            json!({ "success": false, "error": "Connection timed out (10s)." }),
        )),
        Ok(Err(TestConnectionError::Message(e))) => {
            Ok(Json(json!({ "success": false, "error": e })))
        }
        Ok(Ok(())) => Ok(Json(
            json!({ "success": true, "message": "Connection succeeded." }),
        )),
    }
}
