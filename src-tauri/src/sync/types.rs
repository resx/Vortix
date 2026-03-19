use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyncHashAlg {
    Blake3,
    Xxhash64,
}

impl SyncHashAlg {
    pub fn from_opt(value: Option<&str>) -> Self {
        match value.unwrap_or("blake3").to_lowercase().as_str() {
            "xxhash" | "xxhash64" | "xxh64" => SyncHashAlg::Xxhash64,
            _ => SyncHashAlg::Blake3,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            SyncHashAlg::Blake3 => "blake3",
            SyncHashAlg::Xxhash64 => "xxhash64",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SyncChunkInfo {
    pub hash: String,
    pub size: u64,
    #[serde(rename = "storedSize")]
    pub stored_size: u64,
    pub compressed: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SyncManifestDataV4 {
    #[serde(rename = "format")]
    pub format: String,
    #[serde(rename = "totalSize")]
    pub total_size: u64,
    pub chunks: Vec<SyncChunkInfo>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SyncMetaV4 {
    pub revision: i64,
    #[serde(rename = "lastSyncDeviceId")]
    pub last_sync_device_id: String,
    #[serde(rename = "encryptionSalt")]
    pub encryption_salt: Option<String>,
    #[serde(rename = "encryptionType")]
    pub encryption_type: Option<String>,
    #[serde(rename = "hashAlg")]
    pub hash_alg: String,
    #[serde(rename = "chunkSize")]
    pub chunk_size: u64,
    pub compression: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SyncManifestV4 {
    #[serde(rename = "$schema")]
    pub schema: String,
    pub version: i64,
    #[serde(rename = "deviceId")]
    pub device_id: String,
    #[serde(rename = "exportedAt")]
    pub exported_at: String,
    pub checksum: String,
    #[serde(rename = "syncMeta")]
    pub sync_meta: SyncMetaV4,
    pub data: SyncManifestDataV4,
}
