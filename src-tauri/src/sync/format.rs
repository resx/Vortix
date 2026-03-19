use aes_gcm::{Aes256Gcm, Nonce, aead::AeadMut, KeyInit};
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::server::types::{SyncData, SyncPayloadLegacy, SyncPayloadV3Wire, SyncRemoteMeta};
use crate::sync::crypto::derive_sync_key;
use crate::sync::types::SyncManifestV4;

pub fn compute_checksum_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("sha256:{}", hex::encode(hasher.finalize()))
}

pub fn compute_checksum_value(data: &Value) -> Result<String, String> {
    let json = serde_json::to_string(data).map_err(|_| "checksum serialize failed".to_string())?;
    let mut hasher = Sha256::new();
    hasher.update(json.as_bytes());
    Ok(format!("sha256:{}", hex::encode(hasher.finalize())))
}

pub fn is_v3_json(buf: &[u8]) -> bool {
    let value: Value = match serde_json::from_slice(buf) { Ok(v) => v, Err(_) => return false };
    value.get("$schema").and_then(|v| v.as_str()) == Some("vortix-sync")
        && value.get("version").and_then(|v| v.as_i64()) == Some(3)
}

pub fn parse_v3_payload(buf: &[u8]) -> Result<SyncPayloadV3Wire, String> {
    serde_json::from_slice(buf).map_err(|e| format!("invalid v3 json: {}", e))
}

const SYNC_MAGIC: &[u8; 4] = b"VXSN";
const SYNC_LEGACY_VERSION_PLAINTEXT: u16 = 1;
const SYNC_LEGACY_VERSION_ENCRYPTED: u16 = 2;
const SYNC_SALT_LENGTH: usize = 16;
const SYNC_IV_LENGTH: usize = 12;
const SYNC_TAG_LENGTH: usize = 16;

pub fn parse_legacy_payload(buf: &[u8], encryption_key: Option<&str>) -> Result<(SyncData, i64), String> {
    if buf.len() < 6 {
        let payload: SyncPayloadLegacy = serde_json::from_slice(buf).map_err(|e| format!("legacy json error: {}", e))?;
        return Ok((payload.data, 1));
    }
    if &buf[..4] != SYNC_MAGIC {
        let payload: SyncPayloadLegacy = serde_json::from_slice(buf).map_err(|e| format!("legacy json error: {}", e))?;
        return Ok((payload.data, 1));
    }
    let version = u16::from_be_bytes([buf[4], buf[5]]);
    match version {
        SYNC_LEGACY_VERSION_PLAINTEXT => {
            let payload: SyncPayloadLegacy = serde_json::from_slice(&buf[6..]).map_err(|e| format!("legacy json error: {}", e))?;
            Ok((payload.data, 1))
        }
        SYNC_LEGACY_VERSION_ENCRYPTED => {
            let key = encryption_key.ok_or("missing encryption key")?;
            if buf.len() < 6 + SYNC_SALT_LENGTH + SYNC_IV_LENGTH + SYNC_TAG_LENGTH {
                return Err("legacy payload too short".to_string());
            }
            let (salt_s, iv_s, tag_s, enc_s) = (
                6,
                6 + SYNC_SALT_LENGTH,
                6 + SYNC_SALT_LENGTH + SYNC_IV_LENGTH,
                6 + SYNC_SALT_LENGTH + SYNC_IV_LENGTH + SYNC_TAG_LENGTH,
            );
            let derived = derive_sync_key(key, &buf[salt_s..iv_s]);
            let mut cipher = Aes256Gcm::new_from_slice(&derived).map_err(|_| "invalid key".to_string())?;
            let mut combined = Vec::with_capacity(buf.len() - enc_s + SYNC_TAG_LENGTH);
            combined.extend_from_slice(&buf[enc_s..]);
            combined.extend_from_slice(&buf[tag_s..enc_s]);
            let nonce = Nonce::from_slice(&buf[iv_s..tag_s]);
            let plaintext = cipher.decrypt(nonce, combined.as_ref()).map_err(|_| "legacy decrypt failed".to_string())?;
            let payload: SyncPayloadLegacy = serde_json::from_slice(&plaintext).map_err(|_| "legacy json error".to_string())?;
            Ok((payload.data, 1))
        }
        _ => Err(format!("legacy version unsupported: {}", version)),
    }
}

pub fn parse_manifest_v4(buf: &[u8]) -> Result<SyncManifestV4, String> {
    serde_json::from_slice(buf).map_err(|e| format!("invalid manifest: {}", e))
}

pub fn peek_meta_from_v3(payload: &SyncPayloadV3Wire) -> Option<SyncRemoteMeta> {
    Some(SyncRemoteMeta {
        revision: payload.sync_meta.revision,
        device_id: payload.device_id.clone(),
        exported_at: payload.exported_at.clone(),
    })
}

pub fn peek_meta_from_manifest(manifest: &SyncManifestV4) -> Option<SyncRemoteMeta> {
    Some(SyncRemoteMeta {
        revision: manifest.sync_meta.revision,
        device_id: manifest.device_id.clone(),
        exported_at: manifest.exported_at.clone(),
    })
}
