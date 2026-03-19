use aes_gcm::{Aes256Gcm, Nonce, aead::AeadMut, KeyInit};
use base64::prelude::{Engine as _, BASE64_STANDARD as BASE64_STD};
use pbkdf2::pbkdf2_hmac;
use rand_core::RngCore;
use sha2::Sha256;

use crate::server::types::{SyncData};

const SYNC_PBKDF2_ITERATIONS: u32 = 100_000;
const SYNC_IV_LENGTH: usize = 12;
const SYNC_TAG_LENGTH: usize = 16;
const SYNC_ENC_PREFIX: &str = "ENC:";

pub fn derive_sync_key(password: &str, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, SYNC_PBKDF2_ITERATIONS, &mut key);
    key
}

pub fn encrypt_sync_field(plaintext: &str, key: &[u8; 32]) -> Result<String, String> {
    let mut cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "invalid key".to_string())?;
    let mut iv = [0u8; SYNC_IV_LENGTH];
    rand_core::OsRng.fill_bytes(&mut iv);
    let nonce = Nonce::from_slice(&iv);
    let mut ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|_| "encrypt failed".to_string())?;
    if ciphertext.len() < SYNC_TAG_LENGTH { return Err("ciphertext too short".to_string()); }
    let tag = ciphertext.split_off(ciphertext.len() - SYNC_TAG_LENGTH);
    let mut combined = Vec::with_capacity(SYNC_IV_LENGTH + SYNC_TAG_LENGTH + ciphertext.len());
    combined.extend_from_slice(&iv);
    combined.extend_from_slice(&tag);
    combined.extend_from_slice(&ciphertext);
    Ok(format!("{}{}", SYNC_ENC_PREFIX, BASE64_STD.encode(combined)))
}

pub fn decrypt_sync_field(value: &str, key: &[u8; 32]) -> Result<String, String> {
    if !value.starts_with(SYNC_ENC_PREFIX) { return Ok(value.to_string()); }
    let data = BASE64_STD.decode(&value[SYNC_ENC_PREFIX.len()..]).map_err(|_| "invalid base64".to_string())?;
    if data.len() < SYNC_IV_LENGTH + SYNC_TAG_LENGTH { return Err("ciphertext too short".to_string()); }
    let iv = &data[..SYNC_IV_LENGTH];
    let tag = &data[SYNC_IV_LENGTH..SYNC_IV_LENGTH + SYNC_TAG_LENGTH];
    let ciphertext = &data[SYNC_IV_LENGTH + SYNC_TAG_LENGTH..];
    let mut combined = Vec::with_capacity(ciphertext.len() + tag.len());
    combined.extend_from_slice(ciphertext);
    combined.extend_from_slice(tag);
    let mut cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "invalid key".to_string())?;
    let nonce = Nonce::from_slice(iv);
    let plaintext = cipher.decrypt(nonce, combined.as_ref()).map_err(|_| "decrypt failed".to_string())?;
    String::from_utf8(plaintext).map_err(|_| "invalid utf-8".to_string())
}

pub fn encrypt_sync_data(data: &mut SyncData, key: &[u8; 32]) -> Result<(), String> {
    for conn in &mut data.connections {
        if let Some(pwd) = conn.password.as_ref() { conn.password = Some(encrypt_sync_field(pwd, key)?); }
        if let Some(pk) = conn.private_key.as_ref() { conn.private_key = Some(encrypt_sync_field(pk, key)?); }
        if let Some(pp) = conn.proxy_password.as_ref() { conn.proxy_password = Some(encrypt_sync_field(pp, key)?); }
    }
    for key_row in &mut data.ssh_keys {
        key_row.private_key = encrypt_sync_field(&key_row.private_key, key)?;
        if let Some(pp) = key_row.passphrase.as_ref() { key_row.passphrase = Some(encrypt_sync_field(pp, key)?); }
    }
    Ok(())
}

pub fn decrypt_sync_data(data: &mut SyncData, key: &[u8; 32]) -> Result<(), String> {
    for conn in &mut data.connections {
        if let Some(pwd) = conn.password.as_ref() { conn.password = Some(decrypt_sync_field(pwd, key)?); }
        if let Some(pk) = conn.private_key.as_ref() { conn.private_key = Some(decrypt_sync_field(pk, key)?); }
        if let Some(pp) = conn.proxy_password.as_ref() { conn.proxy_password = Some(decrypt_sync_field(pp, key)?); }
    }
    for key_row in &mut data.ssh_keys {
        key_row.private_key = decrypt_sync_field(&key_row.private_key, key)?;
        if let Some(pp) = key_row.passphrase.as_ref() { key_row.passphrase = Some(decrypt_sync_field(pp, key)?); }
    }
    Ok(())
}
