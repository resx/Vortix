/* ── 共享工具函数 ── */

use axum::http::StatusCode;
use serde_json::Value;
use std::sync::Arc;
use russh::client;

use crate::db::Db;
use super::response::{err, ApiError};
use super::types::*;

/* ── russh 基础 ── */

#[derive(Clone)]
pub struct SimpleHandler;

impl client::Handler for SimpleHandler {
    type Error = russh::Error;
    async fn check_server_key(&mut self, _key: &russh::keys::ssh_key::PublicKey) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

pub async fn establish_russh_session(host: &str, port: u16) -> Result<client::Handle<SimpleHandler>, String> {
    let config = Arc::new(client::Config::default());
    client::connect(config, (host, port), SimpleHandler)
        .await
        .map_err(|e| format!("russh 连接失败: {}", e))
}

pub fn parse_json_value(raw: &str, fallback: Value) -> Value {
    serde_json::from_str(raw).unwrap_or(fallback)
}

pub fn value_to_json_string(value: &Value, fallback: &str) -> String {
    match value {
        Value::Null => fallback.to_string(),
        Value::String(s) => s.clone(),
        _ => serde_json::to_string(value).unwrap_or_else(|_| fallback.to_string()),
    }
}

pub fn string_or_default(value: String, fallback: &str) -> String {
    if value.trim().is_empty() { fallback.to_string() } else { value }
}

pub fn to_connection_public(row: ConnectionRow) -> ConnectionPublic {
    ConnectionPublic {
        id: row.id,
        folder_id: row.folder_id,
        name: row.name,
        protocol: row.protocol,
        host: row.host,
        port: row.port,
        username: row.username,
        auth_method: row.auth_method,
        has_password: !row.encrypted_password.as_deref().unwrap_or("").is_empty(),
        has_private_key: !row.encrypted_private_key.as_deref().unwrap_or("").is_empty(),
        sort_order: row.sort_order,
        remark: row.remark,
        color_tag: row.color_tag,
        environment: if row.environment.is_empty() { "无".to_string() } else { row.environment },
        auth_type: if row.auth_type.is_empty() { "password".to_string() } else { row.auth_type },
        proxy_type: if row.proxy_type.is_empty() { "关闭".to_string() } else { row.proxy_type },
        proxy_host: if row.proxy_host.is_empty() { "127.0.0.1".to_string() } else { row.proxy_host },
        proxy_port: if row.proxy_port <= 0 { 7890 } else { row.proxy_port },
        proxy_username: row.proxy_username,
        proxy_timeout: if row.proxy_timeout <= 0 { 5 } else { row.proxy_timeout },
        jump_server_id: row.jump_server_id,
        preset_id: row.preset_id,
        private_key_id: row.private_key_id,
        jump_key_id: row.jump_key_id,
        has_passphrase: !row.encrypted_passphrase.as_deref().unwrap_or("").is_empty(),
        tunnels: parse_json_value(&row.tunnels, Value::Array(vec![])),
        env_vars: parse_json_value(&row.env_vars, Value::Array(vec![])),
        advanced: parse_json_value(&row.advanced, Value::Object(serde_json::Map::new())),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

pub async fn mark_local_dirty(db: &Db) -> Result<(), ApiError> {
    sqlx::query("UPDATE sync_state SET local_dirty = 1 WHERE id = 1")
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(())
}

pub async fn insert_connection(db: &Db, row: &ConnectionRow) -> Result<(), ApiError> {
    sqlx::query("INSERT INTO connections (id, folder_id, name, protocol, host, port, username, auth_method, encrypted_password, encrypted_private_key, sort_order, remark, color_tag, environment, auth_type, proxy_type, proxy_host, proxy_port, proxy_username, proxy_password, proxy_timeout, jump_server_id, preset_id, private_key_id, jump_key_id, encrypted_passphrase, tunnels, env_vars, advanced, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&row.id).bind(&row.folder_id).bind(&row.name).bind(&row.protocol)
        .bind(&row.host).bind(row.port).bind(&row.username).bind(&row.auth_method)
        .bind(&row.encrypted_password).bind(&row.encrypted_private_key)
        .bind(row.sort_order).bind(&row.remark).bind(&row.color_tag)
        .bind(&row.environment).bind(&row.auth_type).bind(&row.proxy_type)
        .bind(&row.proxy_host).bind(row.proxy_port).bind(&row.proxy_username)
        .bind(&row.proxy_password).bind(row.proxy_timeout).bind(&row.jump_server_id)
        .bind(&row.preset_id).bind(&row.private_key_id).bind(&row.jump_key_id)
        .bind(&row.encrypted_passphrase).bind(&row.tunnels).bind(&row.env_vars)
        .bind(&row.advanced).bind(&row.created_at).bind(&row.updated_at)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(())
}

pub async fn update_connection_row(db: &Db, row: &ConnectionRow) -> Result<(), ApiError> {
    sqlx::query("UPDATE connections SET folder_id = ?, name = ?, protocol = ?, host = ?, port = ?, username = ?, auth_method = ?, encrypted_password = ?, encrypted_private_key = ?, sort_order = ?, remark = ?, color_tag = ?, environment = ?, auth_type = ?, proxy_type = ?, proxy_host = ?, proxy_port = ?, proxy_username = ?, proxy_password = ?, proxy_timeout = ?, jump_server_id = ?, preset_id = ?, private_key_id = ?, jump_key_id = ?, encrypted_passphrase = ?, tunnels = ?, env_vars = ?, advanced = ?, updated_at = ? WHERE id = ?")
        .bind(&row.folder_id).bind(&row.name).bind(&row.protocol).bind(&row.host)
        .bind(row.port).bind(&row.username).bind(&row.auth_method)
        .bind(&row.encrypted_password).bind(&row.encrypted_private_key)
        .bind(row.sort_order).bind(&row.remark).bind(&row.color_tag)
        .bind(&row.environment).bind(&row.auth_type).bind(&row.proxy_type)
        .bind(&row.proxy_host).bind(row.proxy_port).bind(&row.proxy_username)
        .bind(&row.proxy_password).bind(row.proxy_timeout).bind(&row.jump_server_id)
        .bind(&row.preset_id).bind(&row.private_key_id).bind(&row.jump_key_id)
        .bind(&row.encrypted_passphrase).bind(&row.tunnels).bind(&row.env_vars)
        .bind(&row.advanced).bind(&row.updated_at).bind(&row.id)
        .execute(&db.pool)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(())
}

