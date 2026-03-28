use axum::http::StatusCode;
use serde_json::Value;

use crate::db::Db;
use crate::sync::service::mark_sync_dirty;

use super::super::response::{ApiError, err};
use super::super::types::{ConnectionPublic, ConnectionRow};
use super::json_utils::parse_json_value;

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
        has_private_key: !row
            .encrypted_private_key
            .as_deref()
            .unwrap_or("")
            .is_empty(),
        sort_order: row.sort_order,
        remark: row.remark,
        color_tag: row.color_tag,
        environment: if row.environment.is_empty() {
            "无".to_string()
        } else {
            row.environment
        },
        auth_type: if row.auth_type.is_empty() {
            "password".to_string()
        } else {
            row.auth_type
        },
        proxy_type: if row.proxy_type.is_empty() {
            "关闭".to_string()
        } else {
            row.proxy_type
        },
        proxy_host: if row.proxy_host.is_empty() {
            "127.0.0.1".to_string()
        } else {
            row.proxy_host
        },
        proxy_port: if row.proxy_port <= 0 { 7890 } else { row.proxy_port },
        proxy_username: row.proxy_username,
        proxy_timeout: if row.proxy_timeout <= 0 {
            5
        } else {
            row.proxy_timeout
        },
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
    mark_sync_dirty(db)
        .await
        .map_err(|e| err(StatusCode::INTERNAL_SERVER_ERROR, e))
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
