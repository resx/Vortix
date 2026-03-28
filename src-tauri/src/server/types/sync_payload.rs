use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;

use super::sync::SyncData;

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

#[derive(Clone, FromRow)]
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
