/* ── 连接 CRUD + 测试 + 密钥上传 ── */

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use chrono::Utc;
use russh::client::{self, Handler};
use russh::keys::{self, PrivateKeyWithHashAlg};
use serde_json::{Map, Value, json};

use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time;
use uuid::Uuid;

use super::super::helpers::{
    EstablishRusshSessionError, HostKeyConnectDecision, RusshAuthConfig, RusshEndpoint,
    RusshJumpHostConfig, authenticate_russh_handle, establish_russh_session,
    establish_russh_session_via_jump, format_private_key_parse_error, insert_connection,
    mark_local_dirty, to_connection_public, update_connection_row,
};
use super::super::response::{ApiResponse, err, ok, ok_empty};
use super::super::types::*;
use crate::db::Db;

pub async fn get_connections(
    State(db): State<Db>,
    Query(query): Query<ConnectionListQuery>,
) -> Result<Json<ApiResponse<Vec<ConnectionPublic>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows = if let Some(folder_id) = query.folder_id {
        sqlx::query_as::<_, ConnectionRow>(
            "SELECT * FROM connections WHERE folder_id = ? ORDER BY sort_order ASC, name ASC",
        )
        .bind(folder_id)
        .fetch_all(&db.pool)
        .await
    } else {
        sqlx::query_as::<_, ConnectionRow>(
            "SELECT * FROM connections ORDER BY sort_order ASC, name ASC",
        )
        .fetch_all(&db.pool)
        .await
    }
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(ok(rows.into_iter().map(to_connection_public).collect()))
}

pub async fn get_connection(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<ConnectionPublic>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "连接不存在"));
    };
    Ok(ok(to_connection_public(row)))
}

struct ResolvedConnectionAuth {
    username: String,
    password: Option<String>,
    private_key: Option<String>,
    passphrase: Option<String>,
}

async fn resolve_key_material(
    db: &Db,
    key_id: Option<&str>,
) -> Result<(Option<String>, Option<String>), (StatusCode, Json<ApiResponse<Value>>)> {
    let Some(key_id) = key_id else {
        return Ok((None, None));
    };

    let key_row = sqlx::query_as::<_, SshKeyRawRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
    )
    .bind(key_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(key_row) = key_row else {
        return Ok((None, None));
    };

    let private_key = Some(
        db.crypto
            .decrypt(&key_row.encrypted_private_key)
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
    );
    let passphrase = match key_row.encrypted_passphrase {
        Some(enc_pp) => Some(
            db.crypto
                .decrypt(&enc_pp)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        None => None,
    };

    Ok((private_key, passphrase))
}

async fn resolve_connection_auth(
    db: &Db,
    row: &ConnectionRow,
) -> Result<ResolvedConnectionAuth, (StatusCode, Json<ApiResponse<Value>>)> {
    let mut username = row.username.clone();
    let mut password: Option<String> = None;
    let mut private_key: Option<String> = None;
    let mut passphrase: Option<String> = None;

    if let Some(preset_id) = &row.preset_id {
        let preset = sqlx::query_as::<_, PresetRow>("SELECT * FROM presets WHERE id = ?")
            .bind(preset_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        if let Some(preset) = preset {
            username = preset.username;
            password = Some(
                db.crypto
                    .decrypt(&preset.encrypted_password)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
        }
    } else if let Some(enc_pwd) = &row.encrypted_password {
        if !enc_pwd.is_empty() {
            password = Some(
                db.crypto
                    .decrypt(enc_pwd)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
        }
    }

    let (key_private_key, key_passphrase) =
        resolve_key_material(db, row.private_key_id.as_deref()).await?;
    if key_private_key.is_some() {
        private_key = key_private_key;
        passphrase = key_passphrase;
    } else if let Some(enc_key) = &row.encrypted_private_key {
        if !enc_key.is_empty() {
            private_key = Some(
                db.crypto
                    .decrypt(enc_key)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
            if let Some(enc_pp) = &row.encrypted_passphrase {
                if !enc_pp.is_empty() {
                    passphrase = Some(
                        db.crypto
                            .decrypt(enc_pp)
                            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
                    );
                }
            }
        }
    }

    Ok(ResolvedConnectionAuth {
        username,
        password,
        private_key,
        passphrase,
    })
}

async fn resolve_jump_host_config_by_id(
    db: &Db,
    jump_server_id: Option<&str>,
    override_key_id: Option<&str>,
) -> Result<Option<RusshJumpHostConfig>, (StatusCode, Json<ApiResponse<Value>>)> {
    let Some(jump_server_id) = jump_server_id else {
        return Ok(None);
    };

    let jump_row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(jump_server_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(jump_row) = jump_row else {
        return Ok(None);
    };

    let mut jump_auth = resolve_connection_auth(db, &jump_row).await?;

    if jump_row.auth_type == "jump" && jump_auth.private_key.is_none() {
        let (jump_private_key, jump_passphrase) =
            resolve_key_material(db, jump_row.jump_key_id.as_deref()).await?;
        if jump_private_key.is_some() {
            jump_auth.private_key = jump_private_key;
            jump_auth.passphrase = jump_passphrase;
            jump_auth.password = None;
        }
    }

    let (override_private_key, override_passphrase) =
        resolve_key_material(db, override_key_id).await?;
    if override_private_key.is_some() {
        jump_auth.private_key = override_private_key;
        jump_auth.passphrase = override_passphrase;
        jump_auth.password = None;
    }

    Ok(Some(RusshJumpHostConfig {
        endpoint: RusshEndpoint {
            host: jump_row.host,
            port: jump_row.port as u16,
            username: jump_auth.username.clone(),
            connection_id: Some(jump_row.id),
            connection_name: Some(jump_row.name),
        },
        auth: RusshAuthConfig {
            password: jump_auth.password,
            private_key: jump_auth.private_key,
            passphrase: jump_auth.passphrase,
        },
    }))
}

async fn resolve_jump_host_config(
    db: &Db,
    row: &ConnectionRow,
) -> Result<Option<RusshJumpHostConfig>, (StatusCode, Json<ApiResponse<Value>>)> {
    resolve_jump_host_config_by_id(
        db,
        row.jump_server_id.as_deref(),
        row.jump_key_id.as_deref(),
    )
    .await
}

async fn resolve_jump_connection_payload(
    db: &Db,
    row: &ConnectionRow,
) -> Result<Option<Value>, (StatusCode, Json<ApiResponse<Value>>)> {
    let Some(jump) = resolve_jump_host_config(db, row).await? else {
        return Ok(None);
    };
    let RusshJumpHostConfig {
        endpoint:
            RusshEndpoint {
                host,
                port,
                username,
                connection_id,
                connection_name,
            },
        auth:
            RusshAuthConfig {
                password,
                private_key,
                passphrase,
            },
    } = jump;

    Ok(Some(json!({
        "connectionId": connection_id,
        "connectionName": connection_name,
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "private_key": private_key,
        "passphrase": passphrase,
    })))
}

pub async fn get_connection_credential(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let Some(row) = row else {
        return Err(err(StatusCode::NOT_FOUND, "连接不存在"));
    };

    let mut auth = resolve_connection_auth(&db, &row).await?;
    let (jump_key_private_key, jump_key_passphrase) =
        resolve_key_material(&db, row.jump_key_id.as_deref()).await?;
    let mut proxy_password: Option<String> = None;

    if row.auth_type == "jump" && auth.private_key.is_none() && jump_key_private_key.is_some() {
        auth.private_key = jump_key_private_key.clone();
        auth.passphrase = jump_key_passphrase.clone();
        auth.password = None;
    }

    if !row.proxy_password.is_empty() {
        proxy_password = Some(
            db.crypto
                .decrypt(&row.proxy_password)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        );
    }

    let jump = resolve_jump_connection_payload(&db, &row).await?;

    Ok(ok(json!({
        "host": row.host, "port": row.port, "username": auth.username,
        "password": auth.password, "private_key": auth.private_key, "passphrase": auth.passphrase,
        "jump": jump,
        "proxy_password": proxy_password,
    })))
}

pub async fn get_connection_keys(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<Vec<ConnectionKeyInfo>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let rows = sqlx::query_as::<_, ConnectionRow>(
        "SELECT * FROM connections WHERE encrypted_private_key IS NOT NULL",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let mut keys = Vec::new();
    for row in rows {
        let enc = match row.encrypted_private_key {
            Some(v) if !v.is_empty() => v,
            _ => continue,
        };
        if let Ok(private_key) = db.crypto.decrypt(&enc) {
            keys.push(ConnectionKeyInfo {
                id: row.id,
                name: row.name,
                host: row.host,
                privateKey: private_key,
            });
        }
    }
    Ok(ok(keys))
}

pub async fn create_connection(
    State(db): State<Db>,
    Json(body): Json<CreateConnectionDto>,
) -> Result<(StatusCode, Json<ApiResponse<ConnectionPublic>>), (StatusCode, Json<ApiResponse<Value>>)>
{
    if body.name.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "名称不能为空"));
    }
    if body.name.len() > 255 {
        return Err(err(StatusCode::BAD_REQUEST, "名称长度不能超过 255"));
    }
    let protocol = body.protocol.unwrap_or_else(|| "ssh".to_string());
    let is_local = protocol == "local";
    let host = body.host.unwrap_or_else(|| {
        if is_local {
            "local".to_string()
        } else {
            "".to_string()
        }
    });
    let username = body.username.unwrap_or_else(|| {
        if is_local {
            "local".to_string()
        } else {
            "".to_string()
        }
    });

    if !is_local {
        if host.is_empty() || username.is_empty() {
            return Err(err(StatusCode::BAD_REQUEST, "名称、主机和用户名不能为空"));
        }
        if host.len() > 255 {
            return Err(err(StatusCode::BAD_REQUEST, "主机地址长度不能超过 255"));
        }
        if username.len() > 255 {
            return Err(err(StatusCode::BAD_REQUEST, "用户名长度不能超过 255"));
        }
    }
    if let Some(port) = body.port {
        if port < 1 || port > 65535 {
            return Err(err(StatusCode::BAD_REQUEST, "端口号必须在 1-65535 之间"));
        }
    }

    let encrypted_password = match body.password {
        Some(ref pwd) if !pwd.is_empty() => Some(
            db.crypto
                .encrypt(pwd)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        _ => None,
    };
    let encrypted_private_key = match body.private_key {
        Some(ref key) if !key.is_empty() => Some(
            db.crypto
                .encrypt(key)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        _ => None,
    };
    let encrypted_proxy_password = match body.proxy_password {
        Some(ref pwd) if !pwd.is_empty() => Some(
            db.crypto
                .encrypt(pwd)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        Some(_) => Some(String::new()),
        None => None,
    };
    let encrypted_passphrase = match body.passphrase {
        Some(ref pass) if !pass.is_empty() => Some(
            db.crypto
                .encrypt(pass)
                .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
        ),
        _ => None,
    };

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let row = ConnectionRow {
        id: id.clone(),
        folder_id: body.folder_id,
        name: body.name,
        protocol,
        host,
        port: body.port.unwrap_or(22),
        username,
        auth_method: body.auth_method.unwrap_or_else(|| "password".to_string()),
        encrypted_password,
        encrypted_private_key,
        sort_order: 0,
        remark: body.remark.unwrap_or_default(),
        color_tag: body.color_tag,
        environment: body.environment.unwrap_or_else(|| "无".to_string()),
        auth_type: body.auth_type.unwrap_or_else(|| "password".to_string()),
        proxy_type: body.proxy_type.unwrap_or_else(|| "关闭".to_string()),
        proxy_host: body.proxy_host.unwrap_or_else(|| "127.0.0.1".to_string()),
        proxy_port: body.proxy_port.unwrap_or(7890),
        proxy_username: body.proxy_username.unwrap_or_default(),
        proxy_password: encrypted_proxy_password.unwrap_or_default(),
        proxy_timeout: body.proxy_timeout.unwrap_or(5),
        jump_server_id: body.jump_server_id,
        preset_id: body.preset_id,
        private_key_id: body.private_key_id,
        jump_key_id: body.jump_key_id,
        encrypted_passphrase,
        tunnels: body.tunnels.unwrap_or_else(|| "[]".to_string()),
        env_vars: body.env_vars.unwrap_or_else(|| "[]".to_string()),
        advanced: body.advanced.unwrap_or_else(|| "{}".to_string()),
        created_at: now.clone(),
        updated_at: now,
    };
    insert_connection(&db, &row).await?;
    mark_local_dirty(&db).await?;
    Ok((StatusCode::CREATED, ok(to_connection_public(row))))
}

pub async fn update_connection(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<ConnectionPublic>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let mut row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| err(StatusCode::NOT_FOUND, "连接不存在"))?;
    let obj = body
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "请求体必须是对象"))?;

    if let Some(Value::String(v)) = obj.get("folder_id") {
        row.folder_id = Some(v.clone());
    } else if obj.contains_key("folder_id") {
        row.folder_id = None;
    }
    if let Some(Value::String(v)) = obj.get("name") {
        row.name = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("protocol") {
        row.protocol = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("host") {
        row.host = v.clone();
    }
    if let Some(Value::Number(v)) = obj.get("port") {
        if let Some(p) = v.as_i64() {
            row.port = p;
        }
    }
    if let Some(Value::String(v)) = obj.get("username") {
        row.username = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("auth_method") {
        row.auth_method = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("remark") {
        row.remark = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("color_tag") {
        row.color_tag = Some(v.clone());
    }
    if obj.contains_key("color_tag") && obj.get("color_tag") == Some(&Value::Null) {
        row.color_tag = None;
    }
    if let Some(Value::String(v)) = obj.get("environment") {
        row.environment = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("auth_type") {
        row.auth_type = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("proxy_type") {
        row.proxy_type = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("proxy_host") {
        row.proxy_host = v.clone();
    }
    if let Some(Value::Number(v)) = obj.get("proxy_port") {
        if let Some(p) = v.as_i64() {
            row.proxy_port = p;
        }
    }
    if let Some(Value::String(v)) = obj.get("proxy_username") {
        row.proxy_username = v.clone();
    }
    if let Some(Value::Number(v)) = obj.get("proxy_timeout") {
        if let Some(p) = v.as_i64() {
            row.proxy_timeout = p;
        }
    }
    if let Some(Value::String(v)) = obj.get("jump_server_id") {
        row.jump_server_id = Some(v.clone());
    }
    if obj.contains_key("jump_server_id") && obj.get("jump_server_id") == Some(&Value::Null) {
        row.jump_server_id = None;
    }
    if let Some(Value::String(v)) = obj.get("preset_id") {
        row.preset_id = Some(v.clone());
    }
    if obj.contains_key("preset_id") && obj.get("preset_id") == Some(&Value::Null) {
        row.preset_id = None;
    }
    if let Some(Value::String(v)) = obj.get("private_key_id") {
        row.private_key_id = Some(v.clone());
    }
    if obj.contains_key("private_key_id") && obj.get("private_key_id") == Some(&Value::Null) {
        row.private_key_id = None;
    }
    if let Some(Value::String(v)) = obj.get("jump_key_id") {
        row.jump_key_id = Some(v.clone());
    }
    if obj.contains_key("jump_key_id") && obj.get("jump_key_id") == Some(&Value::Null) {
        row.jump_key_id = None;
    }
    if let Some(Value::String(v)) = obj.get("tunnels") {
        row.tunnels = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("env_vars") {
        row.env_vars = v.clone();
    }
    if let Some(Value::String(v)) = obj.get("advanced") {
        row.advanced = v.clone();
    }

    if obj.contains_key("password") {
        match obj.get("password") {
            Some(Value::String(v)) if !v.is_empty() => {
                row.encrypted_password = Some(
                    db.crypto
                        .encrypt(v)
                        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
                );
            }
            _ => row.encrypted_password = None,
        }
    }
    if obj.contains_key("private_key") {
        match obj.get("private_key") {
            Some(Value::String(v)) if !v.is_empty() => {
                row.encrypted_private_key = Some(
                    db.crypto
                        .encrypt(v)
                        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
                );
            }
            _ => row.encrypted_private_key = None,
        }
    }
    if obj.contains_key("proxy_password") {
        match obj.get("proxy_password") {
            Some(Value::String(v)) if !v.is_empty() => {
                row.proxy_password = db
                    .crypto
                    .encrypt(v)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            }
            _ => row.proxy_password = "".to_string(),
        }
    }
    if obj.contains_key("passphrase") {
        match obj.get("passphrase") {
            Some(Value::String(v)) if !v.is_empty() => {
                row.encrypted_passphrase = Some(
                    db.crypto
                        .encrypt(v)
                        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
                );
            }
            _ => row.encrypted_passphrase = None,
        }
    }

    row.updated_at = Utc::now().to_rfc3339();
    update_connection_row(&db, &row).await?;
    mark_local_dirty(&db).await?;
    Ok(ok(to_connection_public(row)))
}

pub async fn delete_connection(
    State(db): State<Db>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let result = sqlx::query("DELETE FROM connections WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if result.rows_affected() == 0 {
        return Err(err(StatusCode::NOT_FOUND, "连接不存在"));
    }
    mark_local_dirty(&db).await?;
    Ok(ok_empty())
}

pub async fn batch_update_connections(
    State(db): State<Db>,
    Json(body): Json<BatchUpdateConnectionsDto>,
) -> Result<Json<ApiResponse<Vec<ConnectionPublic>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    if body.ids.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "ids 不能为空"));
    }
    if body.ids.len() > 100 {
        return Err(err(StatusCode::BAD_REQUEST, "批量操作不能超过 100 条"));
    }
    let obj = body
        .updates
        .as_object()
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "updates 不能为空"))?;

    let mut allowed = Map::new();
    for key in [
        "folder_id",
        "color_tag",
        "remark",
        "environment",
        "port",
        "username",
        "auth_type",
        "proxy_type",
        "proxy_host",
        "proxy_port",
        "proxy_username",
        "proxy_timeout",
        "jump_server_id",
        "env_vars",
        "advanced",
    ] {
        if let Some(v) = obj.get(key) {
            allowed.insert(key.to_string(), v.clone());
        }
    }

    let mut enc_pwd: Option<String> = None;
    let mut enc_proxy: Option<String> = None;
    if let Some(Value::String(p)) = obj.get("password") {
        if !p.is_empty() {
            enc_pwd = Some(
                db.crypto
                    .encrypt(p)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
        }
    }
    if let Some(Value::String(p)) = obj.get("proxy_password") {
        if !p.is_empty() {
            enc_proxy = Some(
                db.crypto
                    .encrypt(p)
                    .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
            );
        }
    }
    if allowed.is_empty() && enc_pwd.is_none() && enc_proxy.is_none() {
        return Err(err(StatusCode::BAD_REQUEST, "没有可更新的字段"));
    }

    let mut results = Vec::new();
    for id in body.ids {
        let mut row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
            .bind(&id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        let Some(mut row) = row.take() else { continue };
        for (key, value) in &allowed {
            match (key.as_str(), value) {
                ("folder_id", Value::String(v)) => row.folder_id = Some(v.clone()),
                ("folder_id", Value::Null) => row.folder_id = None,
                ("color_tag", Value::String(v)) => row.color_tag = Some(v.clone()),
                ("color_tag", Value::Null) => row.color_tag = None,
                ("remark", Value::String(v)) => row.remark = v.clone(),
                ("environment", Value::String(v)) => row.environment = v.clone(),
                ("port", Value::Number(v)) => {
                    if let Some(p) = v.as_i64() {
                        row.port = p;
                    }
                }
                ("username", Value::String(v)) => row.username = v.clone(),
                ("auth_type", Value::String(v)) => row.auth_type = v.clone(),
                ("proxy_type", Value::String(v)) => row.proxy_type = v.clone(),
                ("proxy_host", Value::String(v)) => row.proxy_host = v.clone(),
                ("proxy_port", Value::Number(v)) => {
                    if let Some(p) = v.as_i64() {
                        row.proxy_port = p;
                    }
                }
                ("proxy_username", Value::String(v)) => row.proxy_username = v.clone(),
                ("proxy_timeout", Value::Number(v)) => {
                    if let Some(p) = v.as_i64() {
                        row.proxy_timeout = p;
                    }
                }
                ("jump_server_id", Value::String(v)) => row.jump_server_id = Some(v.clone()),
                ("jump_server_id", Value::Null) => row.jump_server_id = None,
                ("env_vars", Value::String(v)) => row.env_vars = v.clone(),
                ("advanced", Value::String(v)) => row.advanced = v.clone(),
                _ => {}
            }
        }
        if let Some(ref p) = enc_pwd {
            row.encrypted_password = Some(p.clone());
        }
        if let Some(ref p) = enc_proxy {
            row.proxy_password = p.clone();
        }
        row.updated_at = Utc::now().to_rfc3339();
        update_connection_row(&db, &row).await?;
        results.push(to_connection_public(row));
    }
    if !results.is_empty() {
        mark_local_dirty(&db).await?;
    }
    Ok(ok(results))
}

pub async fn ping_connections(
    State(db): State<Db>,
    Json(body): Json<Value>,
) -> Result<Json<ApiResponse<HashMap<String, Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    let ids = body
        .get("ids")
        .and_then(|v| v.as_array())
        .ok_or_else(|| err(StatusCode::BAD_REQUEST, "ids 不能为空"))?;
    if ids.is_empty() {
        return Ok(ok(HashMap::new()));
    }
    if ids.len() > 50 {
        return Err(err(StatusCode::BAD_REQUEST, "批量 ping 数量不能超过 50"));
    }

    let mut results: HashMap<String, Value> = HashMap::new();
    let mut tasks = Vec::new();
    for id_val in ids {
        let Some(id) = id_val.as_str() else { continue };
        let db = db.clone();
        let id = id.to_string();
        tasks.push(tokio::spawn(async move {
            let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
                .bind(&id)
                .fetch_optional(&db.pool)
                .await
                .ok()
                .flatten();
            if let Some(row) = row {
                if row.protocol == "local" || row.host.is_empty() {
                    return (id, Value::Null);
                }
                let start = Instant::now();
                let addr = format!("{}:{}", row.host, row.port);
                let ok = time::timeout(Duration::from_secs(5), TcpStream::connect(addr))
                    .await
                    .is_ok();
                if ok {
                    return (
                        id,
                        Value::Number((start.elapsed().as_millis() as i64).into()),
                    );
                }
            }
            (id, Value::Null)
        }));
    }
    for task in tasks {
        if let Ok((id, val)) = task.await {
            results.insert(id, val);
        }
    }
    Ok(ok(results))
}

pub async fn test_ssh_connection(
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

pub async fn test_ssh_connection_secure(
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

pub async fn test_local_terminal(
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
    let working_dir = body
        .get("workingDir")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    if let Some(dir) = &working_dir {
        match std::fs::metadata(dir) {
            Ok(meta) => {
                if !meta.is_dir() {
                    return Ok(Json(
                        json!({ "success": false, "error": format!("工作目录不是文件夹: {}", dir) }),
                    ));
                }
            }
            Err(_) => {
                return Ok(Json(
                    json!({ "success": false, "error": format!("工作目录不存在: {}", dir) }),
                ));
            }
        }
    }

    let (cmd, args): (&str, Vec<&str>) = match shell.as_str() {
        "cmd" => ("cmd.exe", vec!["/C", "exit", "0"]),
        "bash" => ("bash", vec!["-c", "exit 0"]),
        "powershell" => ("powershell", vec!["-NoProfile", "-Command", "exit 0"]),
        "powershell7" => ("pwsh", vec!["-NoProfile", "-Command", "exit 0"]),
        "wsl" => ("wsl", vec!["--", "echo", "ok"]),
        "zsh" => ("zsh", vec!["-c", "exit 0"]),
        "fish" => ("fish", vec!["-c", "exit 0"]),
        _ => {
            return Ok(Json(
                json!({ "success": false, "error": format!("不支持的 Shell 类型: {}", shell) }),
            ));
        }
    };

    let mut command = Command::new(cmd);
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
                    json!({ "success": false, "error": format!("Shell 退出码异常: {:?}", code) }),
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

pub async fn upload_ssh_key_secure(
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
    }).await;

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

pub async fn upload_ssh_key(
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
            if let Ok(p) = db.crypto.decrypt(&row.encrypted_private_key) { private_key = Some(p); }
            if let Some(enc) = row.encrypted_passphrase {
                if let Ok(pp) = db.crypto.decrypt(&enc) { passphrase = Some(pp); }
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
            handle.authenticate_publickey(
                &username,
                PrivateKeyWithHashAlg::new(
                    Arc::new(key_pair),
                    handle.best_supported_rsa_hash().await.map_err(|e| e.to_string())?.flatten(),
                ),
            ).await.map_err(|e| format!("认证失败: {e}"))?
        } else if let Some(pwd) = password.as_deref() {
            handle.authenticate_password(&username, pwd)
                .await.map_err(|e| format!("认证失败: {e}"))?
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
        
        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut exit_status: u32 = 0;

        while let Some(msg) = channel.wait().await {
            match msg {
                russh::ChannelMsg::Data { data } => stdout.push_str(&String::from_utf8_lossy(&data)),
                russh::ChannelMsg::ExtendedData { data, ext: _ } => stderr.push_str(&String::from_utf8_lossy(&data)),
                russh::ChannelMsg::ExitStatus { exit_status: code } => exit_status = code,
                russh::ChannelMsg::Eof | russh::ChannelMsg::Close => break,
                _ => {}
            }
        }

        if exit_status == 0 {
            Ok(())
        } else {
            Err(if stderr.trim().is_empty() { format!("命令退出码: {}", exit_status) } else { stderr })
        }
    }).await;

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
