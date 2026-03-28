use serde::{Deserialize, Serialize};
use sqlx::FromRow;

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
pub(crate) struct RawConnectionCredentialRow {
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
pub(crate) struct ResolvedAuth {
    pub username: String,
    pub password: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
}
