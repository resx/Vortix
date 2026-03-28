use anyhow::{Context, Result};
use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};
use std::fs;
use std::path::PathBuf;

use crate::crypto::Crypto;
use crate::time_utils::now_compact;

mod backup;
mod legacy;
mod legacy_paths;
mod schema;
pub mod sftp_dir_cache;
pub mod transfer_history;

const APP_DIR_NAME: &str = "Vortix";
const DIR_CACHE: &str = "cache";
const DIR_DATA: &str = "data";
const DIR_REMOTE: &str = "remote";
const DIR_HISTORY: &str = "history";
const DIR_LOGS: &str = "logs";
const DIR_REPOSITORY: &str = "repository";
const DIR_INTERNAL: &str = ".internal";
const DIR_KEYS: &str = "keys";
const DIR_BACKUPS: &str = "backups";
const DIR_SYNC: &str = "sync";
const FILE_DB: &str = "vortix.db";
const FILE_KEY: &str = "encryption.key";
const FILE_KNOWN_HOSTS: &str = "known_hosts";

#[derive(Clone)]
pub struct Db {
    pub pool: SqlitePool,
    pub crypto: Crypto,
    #[allow(dead_code)]
    pub paths: DbPaths,
    pub app_handle: tauri::AppHandle,
}

#[allow(dead_code)]
#[derive(Clone)]
pub struct DbPaths {
    pub root_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub data_dir: PathBuf,
    pub db_path: PathBuf,
    pub log_dir: PathBuf,
    pub remote_dir: PathBuf,
    pub remote_history_dir: PathBuf,
    pub known_hosts_path: PathBuf,
    pub repository_dir: PathBuf,
    pub internal_dir: PathBuf,
    pub backup_dir: PathBuf,
    pub key_dir: PathBuf,
    pub key_path: PathBuf,
    pub sync_dir: PathBuf,
    pub legacy_dir: Option<PathBuf>,
}

fn resolve_vortix_home() -> Result<PathBuf> {
    if let Ok(value) = std::env::var("VORTIX_HOME") {
        return Ok(PathBuf::from(value));
    }
    if let Some(data_dir) = dirs::data_dir() {
        return Ok(data_dir.join(APP_DIR_NAME));
    }
    tracing::warn!("[Vortix] failed to resolve platform data dir, falling back to temp dir");
    Ok(std::env::temp_dir().join(APP_DIR_NAME))
}

fn build_paths(root_dir: PathBuf) -> DbPaths {
    let cache_dir = root_dir.join(DIR_CACHE);
    let data_dir = root_dir.join(DIR_DATA);
    let repository_dir = root_dir.join(DIR_REPOSITORY);
    let internal_dir = repository_dir.join(DIR_INTERNAL);
    let db_path = internal_dir.join(FILE_DB);
    let log_dir = data_dir.join(DIR_LOGS);
    let remote_dir = data_dir.join(DIR_REMOTE);
    let remote_history_dir = remote_dir.join(DIR_HISTORY);
    let known_hosts_path = remote_dir.join(FILE_KNOWN_HOSTS);
    let backup_dir = repository_dir.join(DIR_BACKUPS);
    let key_dir = repository_dir.join(DIR_KEYS);
    let key_path = key_dir.join(FILE_KEY);
    let sync_dir = repository_dir.join(DIR_SYNC);

    DbPaths {
        root_dir,
        cache_dir,
        data_dir,
        db_path,
        log_dir,
        remote_dir,
        remote_history_dir,
        known_hosts_path,
        repository_dir,
        internal_dir,
        backup_dir,
        key_dir,
        key_path,
        sync_dir,
        legacy_dir: None,
    }
}

fn ensure_dirs(paths: &DbPaths) -> Result<()> {
    for dir in [
        &paths.root_dir,
        &paths.cache_dir,
        &paths.data_dir,
        &paths.log_dir,
        &paths.remote_dir,
        &paths.remote_history_dir,
        &paths.repository_dir,
        &paths.internal_dir,
        &paths.backup_dir,
        &paths.key_dir,
        &paths.sync_dir,
    ] {
        fs::create_dir_all(dir)
            .with_context(|| format!("failed to create directory: {}", dir.display()))?;
    }
    if !paths.known_hosts_path.exists() {
        fs::write(&paths.known_hosts_path, b"").with_context(|| {
            format!(
                "failed to initialize known_hosts file: {}",
                paths.known_hosts_path.display()
            )
        })?;
    }
    Ok(())
}

fn cleanup_obsolete_db_artifacts(paths: &DbPaths) -> Result<()> {
    if let Some(parent) = paths.db_path.parent() {
        if parent != paths.data_dir {
            let old_db = paths.data_dir.join(FILE_DB);
            if old_db.exists() {
                let _ = fs::remove_file(&old_db);
            }
            for suffix in ["-wal", "-shm"] {
                let old_sidecar = PathBuf::from(format!("{}{}", old_db.display(), suffix));
                if old_sidecar.exists() {
                    let _ = fs::remove_file(old_sidecar);
                }
            }
        }
    }
    Ok(())
}

pub async fn init(app: &tauri::AppHandle) -> Result<Db> {
    let root_dir = resolve_vortix_home()?;
    let mut paths = build_paths(root_dir);
    tracing::info!("[Vortix] data root: {}", paths.root_dir.display());
    ensure_dirs(&paths)?;

    let legacy_dir = legacy_paths::find_legacy_dir(app, &paths.root_dir);
    let legacy_key_path = legacy_paths::legacy_key_candidates(&legacy_dir);
    let crypto = Crypto::load_or_migrate(&paths.key_path, legacy_key_path.as_deref())
        .context("failed to initialize encryption key")?;

    legacy_paths::migrate_old_db(&legacy_dir, &paths.db_path)?;
    cleanup_obsolete_db_artifacts(&paths)?;
    paths.legacy_dir = legacy_dir.clone();

    let options = SqliteConnectOptions::new()
        .filename(&paths.db_path)
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .with_context(|| format!("failed to open sqlite db: {}", paths.db_path.display()))?;

    schema::apply_pragmas(&pool).await?;
    schema::apply_migrations(&pool).await?;
    schema::repair_legacy_schema(&pool).await?;
    schema::ensure_sync_state(&pool).await?;

    let is_empty = schema::is_db_empty(&pool).await?;
    if is_empty {
        if let Some(legacy) = legacy_dir.as_ref() {
            if legacy::has_legacy_data(legacy) {
                let summary = legacy::import_all(legacy, &pool).await?;
                legacy::archive_legacy_data(legacy)?;
                tracing::info!(
                    "[Vortix] imported legacy data: folders={}, connections={}, shortcuts={}, ssh_keys={}, presets={}, history={}, logs={}, themes={}, settings={}",
                    summary.folders,
                    summary.connections,
                    summary.shortcuts,
                    summary.ssh_keys,
                    summary.presets,
                    summary.history,
                    summary.logs,
                    summary.themes,
                    summary.settings,
                );
            }
        }
    }

    tracing::info!("[Vortix] active data root: {}", paths.root_dir.display());
    Ok(Db {
        pool,
        crypto,
        paths,
        app_handle: app.clone(),
    })
}

#[allow(dead_code)]
pub async fn export_backup(db: &Db) -> Result<()> {
    let backup_path = db.paths.backup_dir.join(format!("vortix-backup-{}.json", now_compact()));
    backup::export_to_json(&db.pool, &backup_path).await
}

pub use schema::repair_runtime_schema;
