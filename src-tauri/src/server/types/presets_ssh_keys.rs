use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(FromRow, Serialize)]
pub struct PresetPublicRow {
    pub id: String,
    pub name: String,
    pub username: String,
    pub remark: String,
    pub created_at: String,
    pub updated_at: String,
}

#[allow(dead_code)]
#[derive(FromRow)]
pub struct PresetRow {
    pub id: String,
    pub name: String,
    pub username: String,
    pub encrypted_password: String,
    pub remark: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreatePresetDto {
    pub name: String,
    pub username: String,
    pub password: String,
    pub remark: Option<String>,
}

#[derive(FromRow, Serialize)]
pub struct SshKeyRow {
    pub id: String,
    pub name: String,
    pub key_type: String,
    pub public_key: Option<String>,
    pub has_passphrase: i64,
    pub certificate: Option<String>,
    pub remark: String,
    pub description: String,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(FromRow)]
pub struct SshKeyRawRow {
    pub id: String,
    pub name: String,
    pub key_type: String,
    pub public_key: Option<String>,
    pub has_passphrase: i64,
    pub encrypted_private_key: String,
    pub encrypted_passphrase: Option<String>,
    pub certificate: Option<String>,
    pub remark: String,
    pub description: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct CreateSshKeyDto {
    pub name: String,
    pub private_key: String,
    pub public_key: Option<String>,
    pub passphrase: Option<String>,
    pub certificate: Option<String>,
    pub remark: Option<String>,
    pub key_type: Option<String>,
    pub description: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateSshKeyDto {
    pub name: Option<String>,
    pub public_key: Option<String>,
    pub private_key: Option<String>,
    pub passphrase: Option<String>,
    pub certificate: Option<String>,
    pub remark: Option<String>,
}

#[derive(Deserialize)]
pub struct GenerateSshKeyDto {
    pub name: String,
    #[serde(rename = "type")]
    pub key_type: String,
    pub bits: Option<u32>,
    pub passphrase: Option<String>,
    pub comment: Option<String>,
}
