use aes_gcm::{Aes256Gcm, KeyInit, Nonce, aead::AeadMut};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use flate2::{Compression, read::GzDecoder, write::GzEncoder};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};

use crate::server::types::{SyncData, SyncPayloadLegacy, SyncPayloadV3Wire, SyncRemoteMeta};
use crate::sync::crypto::derive_sync_key;
use crate::sync::types::{SyncEnvelopeHeaderV5, SyncManifestV4};

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
    let value: Value = match serde_json::from_slice(buf) {
        Ok(v) => v,
        Err(_) => return false,
    };
    value.get("$schema").and_then(|v| v.as_str()) == Some("vortix-sync")
        && value.get("version").and_then(|v| v.as_i64()) == Some(3)
}

pub fn parse_v3_payload(buf: &[u8]) -> Result<SyncPayloadV3Wire, String> {
    serde_json::from_slice(buf).map_err(|e| format!("invalid v3 json: {}", e))
}

const SYNC_MAGIC: &[u8; 4] = b"VXSN";
const SYNC_V5_MAGIC: &[u8; 4] = b"VXS5";
const SYNC_V5_VERSION: u16 = 5;
const SYNC_LEGACY_VERSION_PLAINTEXT: u16 = 1;
const SYNC_LEGACY_VERSION_ENCRYPTED: u16 = 2;
const SYNC_SALT_LENGTH: usize = 16;
const SYNC_IV_LENGTH: usize = 12;
const SYNC_TAG_LENGTH: usize = 16;

#[derive(Debug, Serialize, Deserialize)]
struct SyncEnvelopeJsonV5 {
    #[serde(rename = "$schema")]
    schema: String,
    version: u16,
    header: SyncEnvelopeHeaderV5,
    #[serde(rename = "ciphertextB64")]
    ciphertext_b64: String,
}

pub fn gzip_compress(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(data)
        .map_err(|e| format!("gzip write failed: {}", e))?;
    encoder
        .finish()
        .map_err(|e| format!("gzip finish failed: {}", e))
}

pub fn gzip_decompress(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut decoder = GzDecoder::new(data);
    let mut buf = Vec::new();
    decoder
        .read_to_end(&mut buf)
        .map_err(|e| format!("gzip decompress failed: {}", e))?;
    Ok(buf)
}

pub fn encode_v5_envelope(
    header: &SyncEnvelopeHeaderV5,
    ciphertext: &[u8],
) -> Result<Vec<u8>, String> {
    let header_bytes =
        serde_json::to_vec(header).map_err(|e| format!("serialize v5 header failed: {}", e))?;
    let header_len =
        u32::try_from(header_bytes.len()).map_err(|_| "v5 header too large".to_string())?;
    let mut buf = Vec::with_capacity(10 + header_bytes.len() + ciphertext.len());
    buf.extend_from_slice(SYNC_V5_MAGIC);
    buf.extend_from_slice(&SYNC_V5_VERSION.to_be_bytes());
    buf.extend_from_slice(&header_len.to_be_bytes());
    buf.extend_from_slice(&header_bytes);
    buf.extend_from_slice(ciphertext);
    Ok(buf)
}

pub fn parse_v5_envelope(buf: &[u8]) -> Result<(SyncEnvelopeHeaderV5, Vec<u8>), String> {
    let trimmed = {
        let mut i = 0usize;
        while i < buf.len() && buf[i].is_ascii_whitespace() {
            i += 1;
        }
        &buf[i..]
    };
    if !trimmed.is_empty() && trimmed[0] == b'{' {
        let envelope: SyncEnvelopeJsonV5 = serde_json::from_slice(trimmed)
            .map_err(|e| format!("invalid v5 envelope json: {}", e))?;
        if envelope.version != 5 {
            return Err(format!("unsupported v5 envelope version: {}", envelope.version));
        }
        if envelope.schema != "vortix-sync-envelope" {
            return Err("invalid v5 envelope schema".to_string());
        }
        let ciphertext = BASE64_STANDARD
            .decode(envelope.ciphertext_b64.as_bytes())
            .map_err(|e| format!("invalid v5 ciphertext base64: {}", e))?;
        if ciphertext.is_empty() {
            return Err("v5 ciphertext missing".to_string());
        }
        return Ok((envelope.header, ciphertext));
    }

    if buf.len() < 10 {
        return Err("v5 payload too short".to_string());
    }
    if &buf[..4] != SYNC_V5_MAGIC {
        return Err("not a v5 envelope".to_string());
    }
    let version = u16::from_be_bytes([buf[4], buf[5]]);
    if version != SYNC_V5_VERSION {
        return Err(format!("unsupported v5 version: {}", version));
    }
    let header_len = u32::from_be_bytes([buf[6], buf[7], buf[8], buf[9]]) as usize;
    if buf.len() < 10 + header_len {
        return Err("v5 header truncated".to_string());
    }
    let header: SyncEnvelopeHeaderV5 = serde_json::from_slice(&buf[10..10 + header_len])
        .map_err(|e| format!("invalid v5 header: {}", e))?;
    let ciphertext = buf[10 + header_len..].to_vec();
    if ciphertext.is_empty() {
        return Err("v5 ciphertext missing".to_string());
    }
    Ok((header, ciphertext))
}

pub fn parse_legacy_payload(
    buf: &[u8],
    encryption_key: Option<&str>,
) -> Result<(SyncData, i64), String> {
    if buf.len() < 6 {
        let payload: SyncPayloadLegacy =
            serde_json::from_slice(buf).map_err(|e| format!("legacy json error: {}", e))?;
        return Ok((payload.data, 1));
    }
    if &buf[..4] != SYNC_MAGIC {
        let payload: SyncPayloadLegacy =
            serde_json::from_slice(buf).map_err(|e| format!("legacy json error: {}", e))?;
        return Ok((payload.data, 1));
    }
    let version = u16::from_be_bytes([buf[4], buf[5]]);
    match version {
        SYNC_LEGACY_VERSION_PLAINTEXT => {
            let payload: SyncPayloadLegacy = serde_json::from_slice(&buf[6..])
                .map_err(|e| format!("legacy json error: {}", e))?;
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
            let mut cipher =
                Aes256Gcm::new_from_slice(&derived).map_err(|_| "invalid key".to_string())?;
            let mut combined = Vec::with_capacity(buf.len() - enc_s + SYNC_TAG_LENGTH);
            combined.extend_from_slice(&buf[enc_s..]);
            combined.extend_from_slice(&buf[tag_s..enc_s]);
            let nonce = Nonce::from_slice(&buf[iv_s..tag_s]);
            let plaintext = cipher
                .decrypt(nonce, combined.as_ref())
                .map_err(|_| "legacy decrypt failed".to_string())?;
            let payload: SyncPayloadLegacy =
                serde_json::from_slice(&plaintext).map_err(|_| "legacy json error".to_string())?;
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

pub fn peek_meta_from_v5(header: &SyncEnvelopeHeaderV5) -> Option<SyncRemoteMeta> {
    Some(SyncRemoteMeta {
        revision: header.revision,
        device_id: header.device_id.clone(),
        exported_at: header.exported_at.clone(),
    })
}
