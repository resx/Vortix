use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::db::legacy;

const FILE_DB: &str = "vortix.db";
const FILE_KEY: &str = "encryption.key";

pub(super) fn find_legacy_dir(app: &tauri::AppHandle, active_root: &Path) -> Option<PathBuf> {
    if let Ok(value) = std::env::var("VORTIX_LEGACY_DATA_DIR") {
        let candidate = PathBuf::from(value);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    let mut candidates = Vec::new();
    if let Ok(app_data) = app.path().app_data_dir() {
        candidates.push(app_data);
    }
    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".vortix"));
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("data"));
        candidates.push(cwd.join("..").join("data"));
    }

    candidates
        .into_iter()
        .find(|candidate| candidate != active_root && is_legacy_candidate(candidate))
}

fn is_legacy_candidate(path: &Path) -> bool {
    path.exists()
        && (path.join(FILE_DB).exists()
            || path.join("db").join(FILE_DB).exists()
            || path.join(FILE_KEY).exists()
            || path.join("keys").join(FILE_KEY).exists()
            || legacy::has_legacy_data(path))
}

pub(super) fn legacy_key_candidates(legacy_dir: &Option<PathBuf>) -> Option<PathBuf> {
    let Some(dir) = legacy_dir.as_ref() else {
        return None;
    };
    for candidate in [dir.join(FILE_KEY), dir.join("keys").join(FILE_KEY)] {
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

pub(super) fn migrate_old_db(legacy_dir: &Option<PathBuf>, new_db_path: &Path) -> Result<()> {
    if new_db_path.exists() {
        return Ok(());
    }
    let Some(dir) = legacy_dir.as_ref() else {
        return Ok(());
    };

    let candidates = [
        dir.join(FILE_DB),
        dir.join("db").join(FILE_DB),
        dir.join("data").join(FILE_DB),
    ];

    for candidate in candidates {
        if !candidate.exists() {
            continue;
        }
        if let Some(parent) = new_db_path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("failed to create sqlite parent dir: {}", parent.display())
            })?;
        }
        tracing::info!(
            "[Vortix] migrating sqlite db: {} -> {}",
            candidate.display(),
            new_db_path.display()
        );
        match fs::rename(&candidate, new_db_path) {
            Ok(_) => {}
            Err(_) => {
                fs::copy(&candidate, new_db_path).with_context(|| {
                    format!("failed to migrate sqlite db: {}", candidate.display())
                })?;
                let _ = fs::remove_file(&candidate);
            }
        }

        for suffix in ["-wal", "-shm"] {
            let from = PathBuf::from(format!("{}{}", candidate.display(), suffix));
            if from.exists() {
                let to = PathBuf::from(format!("{}{}", new_db_path.display(), suffix));
                let _ = fs::rename(&from, &to).or_else(|_| fs::copy(&from, &to).map(|_| ()));
                let _ = fs::remove_file(&from);
            }
        }
        return Ok(());
    }

    Ok(())
}
