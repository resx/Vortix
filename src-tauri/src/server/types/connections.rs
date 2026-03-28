use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;

#[derive(FromRow)]
pub struct ConnectionRow {
    pub id: String,
    pub folder_id: Option<String>,
    pub name: String,
    pub protocol: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_method: String,
    pub encrypted_password: Option<String>,
    pub encrypted_private_key: Option<String>,
    pub sort_order: i64,
    pub remark: String,
    pub color_tag: Option<String>,
    pub environment: String,
    pub auth_type: String,
    pub proxy_type: String,
    pub proxy_host: String,
    pub proxy_port: i64,
    pub proxy_username: String,
    pub proxy_password: String,
    pub proxy_timeout: i64,
    pub jump_server_id: Option<String>,
    pub preset_id: Option<String>,
    pub private_key_id: Option<String>,
    pub jump_key_id: Option<String>,
    pub encrypted_passphrase: Option<String>,
    pub tunnels: String,
    pub env_vars: String,
    pub advanced: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct ConnectionPublic {
    pub id: String,
    pub folder_id: Option<String>,
    pub name: String,
    pub protocol: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_method: String,
    pub has_password: bool,
    pub has_private_key: bool,
    pub sort_order: i64,
    pub remark: String,
    pub color_tag: Option<String>,
    pub environment: String,
    pub auth_type: String,
    pub proxy_type: String,
    pub proxy_host: String,
    pub proxy_port: i64,
    pub proxy_username: String,
    pub proxy_timeout: i64,
    pub jump_server_id: Option<String>,
    pub preset_id: Option<String>,
    pub private_key_id: Option<String>,
    pub jump_key_id: Option<String>,
    pub has_passphrase: bool,
    pub tunnels: Value,
    pub env_vars: Value,
    pub advanced: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateConnectionDto {
    pub folder_id: Option<String>,
    pub name: String,
    pub protocol: Option<String>,
    pub host: Option<String>,
    pub port: Option<i64>,
    pub username: Option<String>,
    pub auth_method: Option<String>,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub remark: Option<String>,
    pub color_tag: Option<String>,
    pub environment: Option<String>,
    pub auth_type: Option<String>,
    pub proxy_type: Option<String>,
    pub proxy_host: Option<String>,
    pub proxy_port: Option<i64>,
    pub proxy_username: Option<String>,
    pub proxy_password: Option<String>,
    pub proxy_timeout: Option<i64>,
    pub jump_server_id: Option<String>,
    pub preset_id: Option<String>,
    pub private_key_id: Option<String>,
    pub jump_key_id: Option<String>,
    pub passphrase: Option<String>,
    pub tunnels: Option<String>,
    pub env_vars: Option<String>,
    pub advanced: Option<String>,
}

#[derive(Deserialize)]
pub struct BatchUpdateConnectionsDto {
    pub ids: Vec<String>,
    pub updates: Value,
}

#[derive(Deserialize)]
pub struct ConnectionListQuery {
    pub folder_id: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Serialize)]
pub struct ConnectionKeyInfo {
    pub id: String,
    pub name: String,
    pub host: String,
    pub privateKey: String,
}
