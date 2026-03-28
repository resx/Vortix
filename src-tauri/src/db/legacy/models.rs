use serde::Deserialize;
use serde_json::Value;

#[derive(Default)]
pub struct ImportSummary {
    pub folders: usize,
    pub connections: usize,
    pub shortcuts: usize,
    pub ssh_keys: usize,
    pub presets: usize,
    pub history: usize,
    pub logs: usize,
    pub themes: usize,
    pub settings: usize,
}

#[derive(Deserialize)]
pub(super) struct FolderRow {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) parent_id: Option<String>,
    pub(super) sort_order: Option<i64>,
    pub(super) created_at: String,
    pub(super) updated_at: String,
}

#[derive(Deserialize)]
pub(super) struct ConnectionRow {
    pub(super) id: String,
    pub(super) folder_id: Option<String>,
    pub(super) name: String,
    pub(super) protocol: String,
    pub(super) host: String,
    pub(super) port: i64,
    pub(super) username: String,
    pub(super) auth_method: String,
    pub(super) encrypted_password: Option<String>,
    pub(super) encrypted_private_key: Option<String>,
    pub(super) sort_order: Option<i64>,
    pub(super) remark: Option<String>,
    pub(super) color_tag: Option<String>,
    pub(super) environment: Option<String>,
    pub(super) auth_type: Option<String>,
    pub(super) proxy_type: Option<String>,
    pub(super) proxy_host: Option<String>,
    pub(super) proxy_port: Option<i64>,
    pub(super) proxy_username: Option<String>,
    pub(super) proxy_password: Option<String>,
    pub(super) proxy_timeout: Option<i64>,
    pub(super) jump_server_id: Option<String>,
    pub(super) preset_id: Option<String>,
    pub(super) private_key_id: Option<String>,
    pub(super) jump_key_id: Option<String>,
    pub(super) encrypted_passphrase: Option<String>,
    pub(super) tunnels: Option<String>,
    pub(super) env_vars: Option<String>,
    pub(super) advanced: Option<String>,
    pub(super) created_at: String,
    pub(super) updated_at: String,
}

#[derive(Deserialize)]
pub(super) struct ShortcutRow {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) command: String,
    pub(super) remark: Option<String>,
    pub(super) group_name: Option<String>,
    pub(super) sort_order: Option<i64>,
    pub(super) created_at: String,
    pub(super) updated_at: String,
}

#[derive(Deserialize)]
pub(super) struct ShortcutGroupRow {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) sort_order: Option<i64>,
    pub(super) created_at: String,
    pub(super) updated_at: String,
}

#[derive(Deserialize)]
pub(super) struct SshKeyRow {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) key_type: String,
    pub(super) public_key: Option<String>,
    pub(super) has_passphrase: bool,
    pub(super) encrypted_private_key: String,
    pub(super) encrypted_passphrase: Option<String>,
    pub(super) certificate: Option<String>,
    pub(super) remark: Option<String>,
    pub(super) description: Option<String>,
    pub(super) created_at: String,
}

#[derive(Deserialize)]
pub(super) struct PresetRow {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) username: String,
    pub(super) encrypted_password: String,
    pub(super) remark: Option<String>,
    pub(super) created_at: String,
    pub(super) updated_at: String,
}

#[derive(Deserialize)]
pub(super) struct ThemeRow {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) mode: String,
    pub(super) version: Option<i64>,
    pub(super) author: Option<String>,
    pub(super) terminal: Value,
    pub(super) highlights: Value,
    pub(super) ui: Option<Value>,
    pub(super) created_at: String,
    pub(super) updated_at: String,
}

#[derive(Deserialize)]
pub(super) struct HistoryRow {
    pub(super) id: i64,
    pub(super) connection_id: String,
    pub(super) command: String,
    pub(super) executed_at: String,
}

#[derive(Deserialize)]
pub(super) struct LogRow {
    pub(super) id: i64,
    pub(super) connection_id: String,
    pub(super) event: String,
    pub(super) message: Option<String>,
    pub(super) duration_ms: Option<i64>,
    pub(super) created_at: String,
}

#[derive(Deserialize)]
pub(super) struct SyncState {
    #[serde(rename = "deviceId")]
    pub(super) device_id: String,
    #[serde(rename = "lastSyncRevision")]
    pub(super) last_sync_revision: i64,
    #[serde(rename = "lastSyncAt")]
    pub(super) last_sync_at: Option<String>,
    #[serde(rename = "localDirty")]
    pub(super) local_dirty: bool,
}
