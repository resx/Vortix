use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::FromRow;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time;
use uuid::Uuid;

use crate::db::Db;
use crate::server::helpers::{insert_connection, to_connection_public, update_connection_row};
use crate::server::types::{
    BatchUpdateConnectionsDto, ConnectionPublic, ConnectionRow, CreateConnectionDto, PresetRow,
    SshKeyRawRow,
};
use crate::time_utils::now_rfc3339;

#[derive(Debug, Clone, Deserialize)]
pub struct ListConnectionsQuery {
    pub folder_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct JumpCredential {
    #[serde(rename = "connectionId")]
    pub connection_id: Option<String>,
    #[serde(rename = "connectionName")]
    pub connection_name: Option<String>,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionCredentialRecord {
    pub host: String,
    pub port: i64,
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
    pub jump: Option<JumpCredential>,
    pub proxy_password: Option<String>,
}

#[derive(Debug, Clone, FromRow)]
struct RawConnectionCredentialRow {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_type: String,
    pub preset_id: Option<String>,
    pub private_key_id: Option<String>,
    pub jump_key_id: Option<String>,
    pub jump_server_id: Option<String>,
    pub encrypted_password: Option<String>,
    pub encrypted_private_key: Option<String>,
    pub encrypted_passphrase: Option<String>,
    pub proxy_password: String,
}

#[derive(Debug, Clone)]
struct ResolvedAuth {
    username: String,
    password: Option<String>,
    private_key: Option<String>,
    passphrase: Option<String>,
}

async fn resolve_key_material(
    db: &Db,
    key_id: Option<&str>,
) -> Result<(Option<String>, Option<String>), String> {
    let Some(key_id) = key_id else {
        return Ok((None, None));
    };
    let key_row = sqlx::query_as::<_, SshKeyRawRow>(
        "SELECT id, name, key_type, public_key, has_passphrase, encrypted_private_key, encrypted_passphrase, certificate, remark, description, created_at FROM ssh_keys WHERE id = ?",
    )
    .bind(key_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    let Some(key_row) = key_row else {
        return Ok((None, None));
    };

    let private_key = Some(
        db.crypto
            .decrypt(&key_row.encrypted_private_key)
            .map_err(|e| e.to_string())?,
    );
    let passphrase = match key_row.encrypted_passphrase {
        Some(enc) => Some(db.crypto.decrypt(&enc).map_err(|e| e.to_string())?),
        None => None,
    };
    Ok((private_key, passphrase))
}

async fn resolve_connection_auth(db: &Db, row: &RawConnectionCredentialRow) -> Result<ResolvedAuth, String> {
    let mut username = row.username.clone();
    let mut password: Option<String> = None;
    let mut private_key: Option<String> = None;
    let mut passphrase: Option<String> = None;

    if let Some(preset_id) = &row.preset_id {
        let preset = sqlx::query_as::<_, PresetRow>("SELECT * FROM presets WHERE id = ?")
            .bind(preset_id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
        if let Some(preset) = preset {
            username = preset.username;
            password = Some(
                db.crypto
                    .decrypt(&preset.encrypted_password)
                    .map_err(|e| e.to_string())?,
            );
        }
    } else if let Some(enc_pwd) = &row.encrypted_password {
        if !enc_pwd.is_empty() {
            password = Some(db.crypto.decrypt(enc_pwd).map_err(|e| e.to_string())?);
        }
    }

    let (key_private_key, key_passphrase) =
        resolve_key_material(db, row.private_key_id.as_deref()).await?;
    if key_private_key.is_some() {
        private_key = key_private_key;
        passphrase = key_passphrase;
    } else if let Some(enc_key) = &row.encrypted_private_key {
        if !enc_key.is_empty() {
            private_key = Some(db.crypto.decrypt(enc_key).map_err(|e| e.to_string())?);
            if let Some(enc_pp) = &row.encrypted_passphrase {
                if !enc_pp.is_empty() {
                    passphrase = Some(db.crypto.decrypt(enc_pp).map_err(|e| e.to_string())?);
                }
            }
        }
    }

    if row.auth_type == "jump" && private_key.is_none() {
        let (jump_key_private, jump_key_passphrase) =
            resolve_key_material(db, row.jump_key_id.as_deref()).await?;
        if jump_key_private.is_some() {
            private_key = jump_key_private;
            passphrase = jump_key_passphrase;
            password = None;
        }
    }

    Ok(ResolvedAuth {
        username,
        password,
        private_key,
        passphrase,
    })
}

async fn resolve_jump_credential(db: &Db, jump_server_id: Option<&str>) -> Result<Option<JumpCredential>, String> {
    let Some(jump_server_id) = jump_server_id else {
        return Ok(None);
    };
    let jump_row = sqlx::query_as::<_, RawConnectionCredentialRow>(
        "SELECT id, name, host, port, username, auth_type, preset_id, private_key_id, jump_key_id, jump_server_id, encrypted_password, encrypted_private_key, encrypted_passphrase, proxy_password FROM connections WHERE id = ?",
    )
    .bind(jump_server_id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;
    let Some(jump_row) = jump_row else {
        return Ok(None);
    };

    let auth = resolve_connection_auth(db, &jump_row).await?;
    Ok(Some(JumpCredential {
        connection_id: Some(jump_row.id),
        connection_name: Some(jump_row.name),
        host: jump_row.host,
        port: jump_row.port,
        username: auth.username,
        password: auth.password,
        private_key: auth.private_key,
        passphrase: auth.passphrase,
    }))
}

pub async fn list_connections(db: &Db, query: Option<ListConnectionsQuery>) -> Result<Vec<ConnectionPublic>, String> {
    let folder_id = query.and_then(|q| q.folder_id);
    let rows = if let Some(folder_id) = folder_id {
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
    .map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(to_connection_public).collect())
}

pub async fn get_connection(db: &Db, id: String) -> Result<ConnectionPublic, String> {
    let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    match row {
        Some(row) => Ok(to_connection_public(row)),
        None => Err("连接不存在".to_string()),
    }
}

pub async fn get_connection_credential(
    db: &Db,
    id: String,
) -> Result<ConnectionCredentialRecord, String> {
    let row = sqlx::query_as::<_, RawConnectionCredentialRow>(
        "SELECT id, name, host, port, username, auth_type, preset_id, private_key_id, jump_key_id, jump_server_id, encrypted_password, encrypted_private_key, encrypted_passphrase, proxy_password FROM connections WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;
    let Some(row) = row else {
        return Err("连接不存在".to_string());
    };

    let auth = resolve_connection_auth(db, &row).await?;
    let jump = resolve_jump_credential(db, row.jump_server_id.as_deref()).await?;
    let proxy_password = if row.proxy_password.is_empty() {
        None
    } else {
        Some(
            db.crypto
                .decrypt(&row.proxy_password)
                .map_err(|e| e.to_string())?,
        )
    };

    Ok(ConnectionCredentialRecord {
        host: row.host,
        port: row.port,
        username: auth.username,
        password: auth.password,
        private_key: auth.private_key,
        passphrase: auth.passphrase,
        jump,
        proxy_password,
    })
}

async fn mark_local_dirty(db: &Db) -> Result<(), String> {
    sqlx::query("UPDATE sync_state SET local_dirty = 1 WHERE id = 1")
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_update_object(payload: Value) -> Result<Map<String, Value>, String> {
    payload
        .as_object()
        .cloned()
        .ok_or_else(|| "请求体必须是对象".to_string())
}

pub async fn create_connection(db: &Db, body: CreateConnectionDto) -> Result<ConnectionPublic, String> {
    if body.name.trim().is_empty() {
        return Err("名称不能为空".to_string());
    }
    if body.name.len() > 255 {
        return Err("名称长度不能超过 255".to_string());
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
    if !is_local && (host.is_empty() || username.is_empty()) {
        return Err("名称、主机和用户名不能为空".to_string());
    }
    if let Some(port) = body.port {
        if !(1..=65535).contains(&port) {
            return Err("端口号必须在 1-65535 之间".to_string());
        }
    }

    let encrypted_password = match body.password {
        Some(ref pwd) if !pwd.is_empty() => Some(db.crypto.encrypt(pwd).map_err(|e| e.to_string())?),
        _ => None,
    };
    let encrypted_private_key = match body.private_key {
        Some(ref key) if !key.is_empty() => Some(db.crypto.encrypt(key).map_err(|e| e.to_string())?),
        _ => None,
    };
    let encrypted_proxy_password = match body.proxy_password {
        Some(ref pwd) if !pwd.is_empty() => Some(db.crypto.encrypt(pwd).map_err(|e| e.to_string())?),
        Some(_) => Some(String::new()),
        None => None,
    };
    let encrypted_passphrase = match body.passphrase {
        Some(ref pass) if !pass.is_empty() => Some(db.crypto.encrypt(pass).map_err(|e| e.to_string())?),
        _ => None,
    };

    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();
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
    insert_connection(db, &row)
        .await
        .map_err(|e| e.1.error.clone().unwrap_or_else(|| "创建连接失败".to_string()))?;
    mark_local_dirty(db).await?;
    Ok(to_connection_public(row))
}

pub async fn update_connection(db: &Db, id: String, payload: Value) -> Result<ConnectionPublic, String> {
    let mut row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "连接不存在".to_string())?;

    let obj = parse_update_object(payload)?;
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
        row.encrypted_password = match obj.get("password") {
            Some(Value::String(v)) if !v.is_empty() => Some(db.crypto.encrypt(v).map_err(|e| e.to_string())?),
            _ => None,
        };
    }
    if obj.contains_key("private_key") {
        row.encrypted_private_key = match obj.get("private_key") {
            Some(Value::String(v)) if !v.is_empty() => Some(db.crypto.encrypt(v).map_err(|e| e.to_string())?),
            _ => None,
        };
    }
    if obj.contains_key("passphrase") {
        row.encrypted_passphrase = match obj.get("passphrase") {
            Some(Value::String(v)) if !v.is_empty() => Some(db.crypto.encrypt(v).map_err(|e| e.to_string())?),
            _ => None,
        };
    }
    if obj.contains_key("proxy_password") {
        row.proxy_password = match obj.get("proxy_password") {
            Some(Value::String(v)) if !v.is_empty() => db.crypto.encrypt(v).map_err(|e| e.to_string())?,
            _ => String::new(),
        };
    }

    row.updated_at = now_rfc3339();
    update_connection_row(db, &row)
        .await
        .map_err(|e| e.1.error.clone().unwrap_or_else(|| "更新连接失败".to_string()))?;
    mark_local_dirty(db).await?;
    Ok(to_connection_public(row))
}

pub async fn delete_connection(db: &Db, id: String) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM connections WHERE id = ?")
        .bind(id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("连接不存在".to_string());
    }
    mark_local_dirty(db).await?;
    Ok(())
}

pub async fn batch_update_connections(
    db: &Db,
    body: BatchUpdateConnectionsDto,
) -> Result<Vec<ConnectionPublic>, String> {
    if body.ids.is_empty() {
        return Err("ids 不能为空".to_string());
    }
    if body.ids.len() > 100 {
        return Err("批量操作不能超过 100 条".to_string());
    }
    let obj = body
        .updates
        .as_object()
        .ok_or_else(|| "updates 不能为空".to_string())?;

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
            enc_pwd = Some(db.crypto.encrypt(p).map_err(|e| e.to_string())?);
        }
    }
    if let Some(Value::String(p)) = obj.get("proxy_password") {
        if !p.is_empty() {
            enc_proxy = Some(db.crypto.encrypt(p).map_err(|e| e.to_string())?);
        }
    }
    if allowed.is_empty() && enc_pwd.is_none() && enc_proxy.is_none() {
        return Err("没有可更新的字段".to_string());
    }

    let mut results = Vec::new();
    for id in body.ids {
        let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
            .bind(&id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
        let Some(mut row) = row else {
            continue;
        };

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
        row.updated_at = now_rfc3339();
        update_connection_row(db, &row)
            .await
            .map_err(|e| e.1.error.clone().unwrap_or_else(|| "批量更新连接失败".to_string()))?;
        results.push(to_connection_public(row));
    }
    if !results.is_empty() {
        mark_local_dirty(db).await?;
    }
    Ok(results)
}

pub async fn ping_connections(db: &Db, ids: Vec<String>) -> Result<HashMap<String, Option<i64>>, String> {
    if ids.len() > 50 {
        return Err("批量 ping 数量不能超过 50".to_string());
    }
    if ids.is_empty() {
        return Ok(HashMap::new());
    }

    let mut tasks = Vec::new();
    for id in ids {
        let db = db.clone();
        tasks.push(tokio::spawn(async move {
            let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
                .bind(&id)
                .fetch_optional(&db.pool)
                .await
                .ok()
                .flatten();
            if let Some(row) = row {
                if row.protocol == "local" || row.host.is_empty() {
                    return (id, None);
                }
                let start = Instant::now();
                let addr = format!("{}:{}", row.host, row.port);
                let ok = time::timeout(Duration::from_secs(5), TcpStream::connect(addr))
                    .await
                    .is_ok();
                if ok {
                    return (id, Some(start.elapsed().as_millis() as i64));
                }
            }
            (id, None)
        }));
    }

    let mut results = HashMap::new();
    for task in tasks {
        if let Ok((id, value)) = task.await {
            results.insert(id, value);
        }
    }
    Ok(results)
}
