use serde_json::{Map, Value};
use uuid::Uuid;

use crate::db::Db;
use crate::server::helpers::{insert_connection, to_connection_public, update_connection_row};
use crate::server::types::{ConnectionPublic, ConnectionRow, CreateConnectionDto};
use crate::sync::service::mark_sync_dirty;
use crate::time_utils::now_rfc3339;

use super::types::ListConnectionsQuery;

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

pub(super) async fn mark_local_dirty(db: &Db) -> Result<(), String> {
    mark_sync_dirty(db).await
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
    let host = body.host.unwrap_or_else(|| if is_local { "local".to_string() } else { "".to_string() });
    let username = body.username.unwrap_or_else(|| if is_local { "local".to_string() } else { "".to_string() });
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
