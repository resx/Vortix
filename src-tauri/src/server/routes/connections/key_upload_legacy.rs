use super::*;

#[allow(dead_code)]
pub(super) async fn upload_ssh_key(
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
        return Err(err(StatusCode::BAD_REQUEST, "请选择要上传的密钥"));
    }

    let conn = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(conn) = conn else {
        return Err(err(StatusCode::NOT_FOUND, "连接不存在"));
    };

    let key_row: Option<(String, Option<String>)> =
        sqlx::query_as("SELECT id, public_key FROM ssh_keys WHERE id = ?")
            .bind(&key_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some((_kid, Some(public_key))) = key_row else {
        return Err(err(StatusCode::NOT_FOUND, "密钥不存在或无公钥"));
    };

    let mut private_key: Option<String> = None;
    let mut passphrase: Option<String> = None;
    if let Some(pk_id) = conn.private_key_id.clone() {
        if let Ok(Some(row)) = sqlx::query_as::<_, SshKeyRawRow>(
            "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
        ).bind(&pk_id).fetch_optional(&db.pool).await {
            if let Ok(p) = db.crypto.decrypt(&row.encrypted_private_key) {
                private_key = Some(p);
            }
            if let Some(enc) = row.encrypted_passphrase {
                if let Ok(pp) = db.crypto.decrypt(&enc) {
                    passphrase = Some(pp);
                }
            }
        }
    }
    if private_key.is_none() {
        if let Some(enc) = conn.encrypted_private_key.clone() {
            if let Ok(p) = db.crypto.decrypt(&enc) {
                private_key = Some(p);
            }
        }
        if let Some(enc) = conn.encrypted_passphrase.clone() {
            if let Ok(pp) = db.crypto.decrypt(&enc) {
                passphrase = Some(pp);
            }
        }
    }
    let password = if private_key.is_none() {
        conn.encrypted_password
            .clone()
            .and_then(|enc| db.crypto.decrypt(&enc).ok())
    } else {
        None
    };
    if private_key.is_none() && password.is_none() {
        return Err(err(StatusCode::BAD_REQUEST, "缺少认证方式"));
    }

    let host = conn.host.clone();
    let port = conn.port as u16;
    let username = conn.username.clone();
    let public_key = public_key.trim_end().to_string();
    let known_hosts_path = db.paths.known_hosts_path.clone();

    let result = time::timeout(Duration::from_secs(15), async move {
        let mut handle = establish_russh_session(
            &host,
            port,
            known_hosts_path,
            HostKeyConnectDecision::Reject,
        )
        .await
        .map_err(|e| e.to_string())?;

        let auth_res = if let Some(pk) = private_key.as_deref() {
            let key_pair = keys::decode_secret_key(pk, passphrase.as_deref())
                .map_err(|e| format!("私钥解析失败: {e}"))?;
            handle
                .authenticate_publickey(
                    &username,
                    PrivateKeyWithHashAlg::new(
                        Arc::new(key_pair),
                        handle
                            .best_supported_rsa_hash()
                            .await
                            .map_err(|e| e.to_string())?
                            .flatten(),
                    ),
                )
                .await
                .map_err(|e| format!("认证失败: {e}"))?
        } else if let Some(pwd) = password.as_deref() {
            handle
                .authenticate_password(&username, pwd)
                .await
                .map_err(|e| format!("认证失败: {e}"))?
        } else {
            return Err("缺少认证方式".to_string());
        };

        if !auth_res.success() {
            return Err("认证被拒绝".to_string());
        }

        let mut channel = handle.channel_open_session().await.map_err(|e| e.to_string())?;
        let escaped = public_key.replace("'", "'\\''");
        let cmd = format!("mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '{}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys", escaped);

        channel.exec(true, cmd).await.map_err(|e| e.to_string())?;

        let mut stderr = String::new();
        let mut exit_status: u32 = 0;

        while let Some(msg) = channel.wait().await {
            match msg {
                russh::ChannelMsg::Data { data } => {
                    let _ = String::from_utf8_lossy(&data);
                }
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
        } else {
            Err(if stderr.trim().is_empty() {
                format!("命令退出码: {}", exit_status)
            } else {
                stderr
            })
        }
    })
    .await;

    match result {
        Err(_) => Err(err(StatusCode::BAD_REQUEST, "连接超时（15s）")),
        Ok(Err(e)) => {
            let error = if e.to_ascii_lowercase().contains("the key is encrypted") {
                format_private_key_parse_error("The key is encrypted", false)
            } else {
                e
            };
            Err(err(StatusCode::BAD_REQUEST, error))
        }
        Ok(Ok(())) => Ok(ok(json!({ "message": "公钥上传成功" }))),
    }
}
