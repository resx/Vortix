use super::*;

pub(super) async fn upload_ssh_key_secure(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let key_id = body
        .get("keyId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if key_id.is_empty() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "Please select an SSH key to upload.",
        ));
    }

    let conn = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(conn) = conn else {
        return Err(err(StatusCode::NOT_FOUND, "Connection not found."));
    };

    let key_row: Option<(String, Option<String>)> =
        sqlx::query_as("SELECT id, public_key FROM ssh_keys WHERE id = ?")
            .bind(&key_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some((_kid, Some(public_key))) = key_row else {
        return Err(err(StatusCode::NOT_FOUND, "SSH public key not found."));
    };

    let mut auth = resolve_connection_auth(&db, &conn).await?;
    let (jump_key_private_key, jump_key_passphrase) =
        resolve_key_material(&db, conn.jump_key_id.as_deref()).await?;
    if conn.auth_type == "jump" && auth.private_key.is_none() && jump_key_private_key.is_some() {
        auth.private_key = jump_key_private_key;
        auth.passphrase = jump_key_passphrase;
        auth.password = None;
    }
    if auth.private_key.is_none() && auth.password.is_none() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "Missing authentication method.",
        ));
    }

    let jump = resolve_jump_host_config(&db, &conn).await?;
    if conn.jump_server_id.is_some() && jump.is_none() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "Jump host connection not found.",
        ));
    }
    let host = conn.host.clone();
    let port = conn.port as u16;
    let username = auth.username.clone();
    let public_key = public_key.trim_end().to_string();
    let trust_host_key = body
        .get("trustHostKey")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let replace_existing = body
        .get("replaceExisting")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let host_key_decision = if replace_existing {
        HostKeyConnectDecision::Replace
    } else if trust_host_key {
        HostKeyConnectDecision::Trust
    } else {
        HostKeyConnectDecision::Reject
    };
    let known_hosts_path = db.paths.known_hosts_path.clone();

    let result = time::timeout(Duration::from_secs(15), async move {
        let endpoint = RusshEndpoint {
            host: host.clone(),
            port,
            username: username.clone(),
            connection_id: Some(id.clone()),
            connection_name: Some(conn.name.clone()),
        };

        let mut handle = if let Some(jump_config) = jump {
            establish_russh_session_via_jump(
                &endpoint,
                known_hosts_path,
                host_key_decision,
                &jump_config,
                host_key_decision,
            )
            .await
            .map(|session| session.handle)
        } else {
            establish_russh_session(&host, port, known_hosts_path, host_key_decision).await
        }
        .map_err(|err| match err {
            EstablishRusshSessionError::HostKeyVerificationRequired(prompt) => {
                let host_role = if conn.jump_server_id.is_some()
                    && prompt.connection_id.as_deref() != Some(id.as_str())
                {
                    "jump"
                } else {
                    "target"
                };
                let hop_count = if conn.jump_server_id.is_some() { 2 } else { 1 };
                let hop_index = if host_role == "jump" || hop_count == 1 { 1 } else { 2 };

                json!({
                    "kind": "hostkey-verification-required",
                    "prompt": {
                        "reason": prompt.reason,
                        "host": prompt.host,
                        "port": prompt.port,
                        "username": prompt.username,
                        "connectionId": prompt.connection_id,
                        "connectionName": prompt.connection_name,
                        "keyType": prompt.key_type,
                        "fingerprintSha256": prompt.fingerprint_sha256,
                        "knownKeyType": prompt.known_key_type,
                        "knownFingerprintSha256": prompt.known_fingerprint_sha256,
                        "hostRole": host_role,
                        "hopIndex": hop_index,
                        "hopCount": hop_count,
                    }
                }).to_string()
            }
            EstablishRusshSessionError::Message(message) => message,
        })?;

        authenticate_russh_handle(
            &mut handle,
            &username,
            &RusshAuthConfig {
                password: auth.password,
                private_key: auth.private_key,
                passphrase: auth.passphrase,
            },
        )
        .await?;

        let mut channel = handle.channel_open_session().await.map_err(|e| e.to_string())?;
        let escaped = public_key.replace("'", "'\\''");
        let cmd = format!("mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys", escaped);

        channel.exec(true, cmd).await.map_err(|e| e.to_string())?;

        let mut stderr = String::new();
        let mut exit_status: u32 = 0;

        while let Some(msg) = channel.wait().await {
            match msg {
                russh::ChannelMsg::ExtendedData { data, ext: _ } => {
                    stderr.push_str(&String::from_utf8_lossy(&data))
                }
                russh::ChannelMsg::ExitStatus { exit_status: code } => exit_status = code,
                russh::ChannelMsg::Eof | russh::ChannelMsg::Close => break,
                _ => {}
            }
        }

        if exit_status == 0 {
            Ok(())
        } else if stderr.trim().is_empty() {
            Err(format!("Remote command exited with status {exit_status}."))
        } else {
            Err(stderr)
        }
    })
    .await;

    match result {
        Err(_) => Err(err(StatusCode::BAD_REQUEST, "Connection timed out (15s).")),
        Ok(Err(e)) => {
            if let Ok(value) = serde_json::from_str::<Value>(&e) {
                if value.get("kind").and_then(|v| v.as_str())
                    == Some("hostkey-verification-required")
                {
                    return Ok(ok(json!({
                        "requiresHostTrust": true,
                        "hostKey": value.get("prompt").cloned().unwrap_or(Value::Null),
                    })));
                }
            }
            Err(err(StatusCode::BAD_REQUEST, e))
        }
        Ok(Ok(())) => Ok(ok(json!({ "message": "SSH public key uploaded." }))),
    }
}
