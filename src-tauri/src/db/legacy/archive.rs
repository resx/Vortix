use anyhow::Result;
use rand_core::RngCore;
use std::fs;
use std::path::Path;

use crate::time_utils::now_compact;

pub fn archive_legacy_data(legacy_dir: &Path) -> Result<()> {
    let timestamp = now_compact();
    let archive_root = legacy_dir.join("legacy").join(timestamp);
    fs::create_dir_all(&archive_root)?;

    move_if_exists(&legacy_dir.join("config"), &archive_root.join("config"))?;
    move_if_exists(&legacy_dir.join("logs"), &archive_root.join("logs"))?;
    move_if_exists(
        &legacy_dir.join("sync-state.json"),
        &archive_root.join("sync-state.json"),
    )?;
    move_if_exists(
        &legacy_dir.join("encryption.key"),
        &archive_root.join("encryption.key"),
    )?;
    Ok(())
}

pub fn generate_device_id() -> String {
    let mut bytes = [0u8; 4];
    rand_core::OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn move_if_exists(src: &Path, dest: &Path) -> Result<()> {
    if !src.exists() {
        return Ok(());
    }
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(src, dest)?;
    Ok(())
}
