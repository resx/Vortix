/* ── 共享类型定义（DTO / Row / 同步结构） ── */

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;

// ── 文件夹 ──

#[derive(FromRow, Serialize)]
pub struct FolderRow {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateFolderDto {
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: Option<i64>,
}

// ── 快捷命令 ──

#[derive(FromRow, Serialize)]
pub struct ShortcutRow {
    pub id: String,
    pub name: String,
    pub command: String,
    pub remark: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateShortcutDto {
    pub name: String,
    pub command: String,
    pub remark: Option<String>,
    pub sort_order: Option<i64>,
}

// ── 连接预设 ──

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

// ── SSH 密钥 ──

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

// ── 连接 ──

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

// ── 主题 ──

#[derive(Deserialize)]
pub struct CreateThemeDto {
    pub name: String,
    pub mode: String,
    pub terminal: Option<Value>,
    pub highlights: Option<Value>,
    pub ui: Option<Value>,
    pub author: Option<String>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct UpdateThemeDto {
    pub name: Option<String>,
    pub mode: Option<String>,
    pub terminal: Option<Value>,
    pub highlights: Option<Value>,
    pub ui: Option<Value>,
    pub author: Option<String>,
}

// ── 文件系统 ──

#[allow(non_snake_case)]
#[derive(Deserialize)]
pub struct PickDirBody {
    pub initialDir: Option<String>,
}

#[derive(Deserialize)]
pub struct PickFileBody {
    pub title: Option<String>,
    pub filters: Option<String>,
}

#[allow(non_snake_case)]
#[derive(Deserialize)]
pub struct PickSavePathBody {
    pub fileName: Option<String>,
    pub filters: Option<String>,
}

// ── 同步 ──

#[derive(Deserialize)]
pub struct SyncRequestBody {
    #[serde(rename = "repoSource")]
    pub repo_source: String,
    #[serde(rename = "encryptionKey")]
    pub encryption_key: Option<String>,
    #[serde(rename = "syncLocalPath")]
    pub sync_local_path: Option<String>,
    #[serde(rename = "syncGitUrl")]
    pub sync_git_url: Option<String>,
    #[serde(rename = "syncGitBranch")]
    pub sync_git_branch: Option<String>,
    #[serde(rename = "syncGitPath")]
    pub sync_git_path: Option<String>,
    #[serde(rename = "syncGitUsername")]
    pub sync_git_username: Option<String>,
    #[serde(rename = "syncGitPassword")]
    pub sync_git_password: Option<String>,
    #[serde(rename = "syncGitSshKey")]
    pub sync_git_ssh_key: Option<String>,
    #[serde(rename = "syncWebdavEndpoint")]
    pub sync_webdav_endpoint: Option<String>,
    #[serde(rename = "syncWebdavPath")]
    pub sync_webdav_path: Option<String>,
    #[serde(rename = "syncWebdavUsername")]
    pub sync_webdav_username: Option<String>,
    #[serde(rename = "syncWebdavPassword")]
    pub sync_webdav_password: Option<String>,
    #[serde(rename = "syncS3Style")]
    pub sync_s3_style: Option<String>,
    #[serde(rename = "syncS3Endpoint")]
    pub sync_s3_endpoint: Option<String>,
    #[serde(rename = "syncS3Path")]
    pub sync_s3_path: Option<String>,
    #[serde(rename = "syncS3Region")]
    pub sync_s3_region: Option<String>,
    #[serde(rename = "syncS3Bucket")]
    pub sync_s3_bucket: Option<String>,
    #[serde(rename = "syncS3AccessKey")]
    pub sync_s3_access_key: Option<String>,
    #[serde(rename = "syncS3SecretKey")]
    pub sync_s3_secret_key: Option<String>,
    #[serde(rename = "syncTlsVerify")]
    pub sync_tls_verify: Option<bool>,
    #[serde(rename = "syncFormatVersion")]
    pub sync_format_version: Option<i64>,
    #[serde(rename = "syncUseChunkedManifest")]
    pub sync_use_chunked_manifest: Option<bool>,
    #[serde(rename = "syncHashAlgorithm")]
    pub sync_hash_algorithm: Option<String>,
    #[serde(rename = "syncChunkSize")]
    pub sync_chunk_size: Option<u64>,
    #[serde(rename = "syncCompressChunks")]
    pub sync_compress_chunks: Option<bool>,
}

#[derive(Clone, Serialize)]
pub struct SyncFileInfo {
    pub exists: bool,
    #[serde(rename = "lastModified")]
    pub last_modified: Option<String>,
    pub size: Option<i64>,
}

#[derive(Serialize)]
pub struct SyncLocalState {
    #[serde(rename = "localDirty")]
    pub local_dirty: bool,
    #[serde(rename = "lastSyncRevision")]
    pub last_sync_revision: i64,
    #[serde(rename = "lastSyncAt")]
    pub last_sync_at: Option<String>,
}

#[derive(Serialize)]
pub struct SyncImportResult {
    pub folders: usize,
    pub connections: usize,
    pub shortcuts: usize,
    #[serde(rename = "sshKeys")]
    pub ssh_keys: usize,
}

/// 轻量级远端变更检测结果
#[derive(Serialize, Clone)]
pub struct RemoteCheckResult {
    #[serde(rename = "hasUpdate")]
    pub has_update: bool,
    #[serde(rename = "remoteHash")]
    pub remote_hash: String,
    #[serde(rename = "localHash")]
    pub local_hash: String,
}

#[derive(Serialize)]
pub struct SyncConflictInfo {
    #[serde(rename = "hasConflict")]
    pub has_conflict: bool,
    pub reason: Option<String>,
    #[serde(rename = "localRevision")]
    pub local_revision: i64,
    #[serde(rename = "remoteRevision")]
    pub remote_revision: i64,
    #[serde(rename = "remoteDeviceId")]
    pub remote_device_id: Option<String>,
    #[serde(rename = "remoteExportedAt")]
    pub remote_exported_at: Option<String>,
}

#[derive(Clone, Serialize, Deserialize, FromRow)]
pub struct SyncFolder {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Serialize, Deserialize, FromRow)]
pub struct SyncShortcut {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub remark: String,
    #[serde(default)]
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

pub fn json_value_default() -> Value {
    Value::Null
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SyncConnection {
    pub id: String,
    #[serde(default)]
    pub folder_id: Option<String>,
    pub name: String,
    pub protocol: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_method: String,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub private_key: Option<String>,
    #[serde(default)]
    pub sort_order: i64,
    #[serde(default)]
    pub remark: String,
    #[serde(default)]
    pub color_tag: Option<String>,
    #[serde(default)]
    pub environment: String,
    #[serde(default)]
    pub auth_type: String,
    #[serde(default)]
    pub proxy_type: String,
    #[serde(default)]
    pub proxy_host: String,
    #[serde(default)]
    pub proxy_port: i64,
    #[serde(default)]
    pub proxy_username: String,
    #[serde(default)]
    pub proxy_password: Option<String>,
    #[serde(default)]
    pub proxy_timeout: i64,
    #[serde(default)]
    pub jump_server_id: Option<String>,
    #[serde(default = "json_value_default")]
    pub tunnels: Value,
    #[serde(default = "json_value_default")]
    pub env_vars: Value,
    #[serde(default = "json_value_default")]
    pub advanced: Value,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct SyncSshKey {
    pub id: String,
    pub name: String,
    pub key_type: String,
    pub private_key: String,
    #[serde(default)]
    pub public_key: Option<String>,
    #[serde(default)]
    pub passphrase: Option<String>,
    #[serde(default)]
    pub certificate: Option<String>,
    #[serde(default)]
    pub remark: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    pub created_at: String,
}

#[derive(Clone, Serialize, Deserialize, Default)]
pub struct SyncData {
    pub folders: Vec<SyncFolder>,
    pub connections: Vec<SyncConnection>,
    pub shortcuts: Vec<SyncShortcut>,
    #[serde(default, rename = "sshKeys")]
    pub ssh_keys: Vec<SyncSshKey>,
}

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct SyncPayloadV3Wire {
    #[serde(rename = "$schema")]
    pub schema: String,
    pub version: i64,
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub checksum: String,
    #[serde(rename = "syncMeta")]
    pub sync_meta: SyncMetaWire,
    pub data: Value,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SyncMetaWire {
    pub revision: i64,
    #[serde(rename = "lastSyncDeviceId")]
    pub last_sync_device_id: String,
    #[serde(rename = "encryptionSalt")]
    pub encryption_salt: Option<String>,
    #[serde(rename = "encryptionType")]
    pub encryption_type: Option<String>,
}

#[derive(Deserialize)]
pub struct SyncPayloadLegacy {
    pub data: SyncData,
}

#[derive(FromRow)]
pub struct SyncStateRow {
    pub device_id: String,
    pub last_sync_revision: i64,
    pub last_sync_at: Option<String>,
    pub local_dirty: i64,
}

pub struct SyncRemoteMeta {
    pub revision: i64,
    pub device_id: String,
    pub exported_at: String,
}

// ── 主题导入 ──

pub struct ThemeImportItem {
    pub name: String,
    pub mode: String,
    pub version: i64,
    pub author: String,
    pub terminal: Value,
    pub highlights: Value,
    pub ui: Option<Value>,
}

pub struct ThemeImportResult {
    pub format: String,
    pub themes: Vec<ThemeImportItem>,
    pub errors: Vec<String>,
}
