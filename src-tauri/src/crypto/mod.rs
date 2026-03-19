/* ── AES-256-GCM 加密/解密（兼容 Node 密文格式） ── */

use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use aes_gcm::aead::{Aead, OsRng};
use anyhow::{Context, Result};
use base64::engine::general_purpose::STANDARD as BASE64_STD;
use base64::Engine;
use rand_core::RngCore;
use std::fs;
use std::path::Path;

const KEY_LEN: usize = 32;
const IV_LEN: usize = 12;
const TAG_LEN: usize = 16;

#[derive(Clone)]
pub struct Crypto {
    key: [u8; KEY_LEN],
}

impl Crypto {
    pub fn load_or_migrate(key_path: &Path, legacy_key_path: Option<&Path>) -> Result<Self> {
        if key_path.exists() {
            return Self::load_from_path(key_path);
        }

        if let Some(legacy) = legacy_key_path {
            if legacy.exists() {
                let key = Self::load_from_path(legacy)?;
                if let Some(parent) = key_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::write(key_path, hex::encode(key.key))?;
                return Ok(key);
            }
        }

        Self::generate_to_path(key_path)
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        let cipher = Aes256Gcm::new_from_slice(&self.key).context("初始化加密器失败")?;
        let mut iv = [0u8; IV_LEN];
        OsRng.fill_bytes(&mut iv);
        let nonce = Nonce::from_slice(&iv);

        let mut ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
            .map_err(|_| anyhow::anyhow!("加密失败"))?;

        if ciphertext.len() < TAG_LEN {
            return Err(anyhow::anyhow!("密文长度异常"));
        }

        let tag = ciphertext.split_off(ciphertext.len() - TAG_LEN);
        let mut combined = Vec::with_capacity(IV_LEN + TAG_LEN + ciphertext.len());
        combined.extend_from_slice(&iv);
        combined.extend_from_slice(&tag);
        combined.extend_from_slice(&ciphertext);

        Ok(BASE64_STD.encode(combined))
    }

    pub fn decrypt(&self, ciphertext_b64: &str) -> Result<String> {
        let data = BASE64_STD
            .decode(ciphertext_b64)
            .context("密文不是有效的 base64")?;

        if data.len() < IV_LEN + TAG_LEN {
            return Err(anyhow::anyhow!("密文长度异常"));
        }

        let iv = &data[..IV_LEN];
        let tag = &data[IV_LEN..IV_LEN + TAG_LEN];
        let ciphertext = &data[IV_LEN + TAG_LEN..];

        let mut combined = Vec::with_capacity(ciphertext.len() + TAG_LEN);
        combined.extend_from_slice(ciphertext);
        combined.extend_from_slice(tag);

        let cipher = Aes256Gcm::new_from_slice(&self.key).context("初始化解密器失败")?;
        let nonce = Nonce::from_slice(iv);
        let plaintext = cipher.decrypt(nonce, combined.as_ref())
            .map_err(|_| anyhow::anyhow!("解密失败"))?;

        Ok(String::from_utf8(plaintext).context("解密结果不是有效 UTF-8")?)
    }

    fn load_from_path(path: &Path) -> Result<Self> {
        let hex_str = fs::read_to_string(path).context("读取加密密钥失败")?;
        let raw = hex::decode(hex_str.trim()).context("加密密钥格式无效")?;
        if raw.len() != KEY_LEN {
            return Err(anyhow::anyhow!("加密密钥长度不正确"));
        }
        let mut key = [0u8; KEY_LEN];
        key.copy_from_slice(&raw);
        Ok(Self { key })
    }

    fn generate_to_path(path: &Path) -> Result<Self> {
        let mut key = [0u8; KEY_LEN];
        OsRng.fill_bytes(&mut key);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, hex::encode(key))?;
        Ok(Self { key })
    }
}
