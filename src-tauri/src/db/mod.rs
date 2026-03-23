use anyhow::{Context, Result};
use sqlx::{
    Row, SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::crypto::Crypto;
use crate::time_utils::{now_compact, now_rfc3339};

mod backup;
mod legacy;

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

pub async fn init(app: &tauri::AppHandle) -> Result<Db> {
    let root_dir = resolve_vortix_home()?;
    let mut paths = build_paths(root_dir);
    tracing::info!("[Vortix] data root: {}", paths.root_dir.display());
    ensure_dirs(&paths)?;

    let legacy_dir = find_legacy_dir(app, &paths.root_dir);
    let legacy_key_path = legacy_key_candidates(&legacy_dir);
    let crypto = Crypto::load_or_migrate(&paths.key_path, legacy_key_path.as_deref())
        .context("failed to initialize encryption key")?;

    migrate_old_db(&legacy_dir, &paths.db_path)?;
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

    apply_pragmas(&pool).await?;
    apply_migrations(&pool).await?;
    repair_legacy_schema(&pool).await?;
    ensure_sync_state(&pool).await?;

    let is_empty = is_db_empty(&pool).await?;
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

#[allow(dead_code)]
pub async fn export_backup(db: &Db) -> Result<()> {
    let backup_path = db.paths.backup_dir.join(format!(
        "vortix-backup-{}.json",
        now_compact()
    ));
    backup::export_to_json(&db.pool, &backup_path).await
}

async fn apply_pragmas(pool: &SqlitePool) -> Result<()> {
    sqlx::query("PRAGMA journal_mode = WAL;")
        .execute(pool)
        .await?;
    sqlx::query("PRAGMA synchronous = NORMAL;")
        .execute(pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(pool)
        .await?;
    sqlx::query("PRAGMA temp_store = MEMORY;")
        .execute(pool)
        .await?;
    Ok(())
}

async fn apply_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;

    let version: i64 = 1;
    let applied_at = now_rfc3339();
    sqlx::query("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .bind(version)
        .bind(applied_at)
        .execute(pool)
        .await?;
    Ok(())
}

async fn repair_legacy_schema(pool: &SqlitePool) -> Result<()> {
    ensure_columns(
        pool,
        "connections",
        &[
            ("environment", "TEXT NOT NULL DEFAULT '无'"),
            ("auth_type", "TEXT NOT NULL DEFAULT 'password'"),
            ("proxy_type", "TEXT NOT NULL DEFAULT '关闭'"),
            ("proxy_host", "TEXT NOT NULL DEFAULT '127.0.0.1'"),
            ("proxy_port", "INTEGER NOT NULL DEFAULT 7890"),
            ("proxy_username", "TEXT NOT NULL DEFAULT ''"),
            ("proxy_password", "TEXT NOT NULL DEFAULT ''"),
            ("proxy_timeout", "INTEGER NOT NULL DEFAULT 5"),
            ("jump_server_id", "TEXT NULL"),
            ("preset_id", "TEXT NULL"),
            ("private_key_id", "TEXT NULL"),
            ("jump_key_id", "TEXT NULL"),
            ("encrypted_passphrase", "TEXT NULL"),
            ("tunnels", "TEXT NOT NULL DEFAULT '[]'"),
            ("env_vars", "TEXT NOT NULL DEFAULT '[]'"),
            ("advanced", "TEXT NOT NULL DEFAULT '{}'"),
        ],
    )
    .await?;

    ensure_columns(
        pool,
        "ssh_keys",
        &[
            ("public_key", "TEXT NULL"),
            ("has_passphrase", "INTEGER NOT NULL DEFAULT 0"),
            ("encrypted_passphrase", "TEXT NULL"),
            ("certificate", "TEXT NULL"),
            ("remark", "TEXT NOT NULL DEFAULT ''"),
            ("description", "TEXT NOT NULL DEFAULT ''"),
        ],
    )
    .await?;

    ensure_columns(
        pool,
        "shortcuts",
        &[("group_name", "TEXT NOT NULL DEFAULT ''")],
    )
    .await?;

    ensure_columns(pool, "themes", &[("ui", "TEXT NULL")]).await?;

    ensure_columns(
        pool,
        "sync_state",
        &[
            ("last_sync_at", "TEXT NULL"),
            ("local_dirty", "INTEGER NOT NULL DEFAULT 0"),
        ],
    )
    .await?;

    ensure_shortcut_groups_table(pool).await?;
    backfill_shortcut_groups(pool).await?;

    Ok(())
}

pub async fn repair_runtime_schema(pool: &SqlitePool) -> Result<()> {
    repair_legacy_schema(pool).await
}

async fn ensure_columns(pool: &SqlitePool, table: &str, columns: &[(&str, &str)]) -> Result<()> {
    let pragma = format!("PRAGMA table_info({table})");
    let existing = sqlx::query(&pragma).fetch_all(pool).await?;
    let existing_names: std::collections::HashSet<String> = existing
        .into_iter()
        .filter_map(|row| row.try_get::<String, _>("name").ok())
        .collect();

    for (column, definition) in columns {
        if existing_names.contains(*column) {
            continue;
        }

        let sql = format!("ALTER TABLE {table} ADD COLUMN {column} {definition}");
        tracing::info!("[Vortix] repairing schema: {}", sql);
        sqlx::query(&sql).execute(pool).await?;
    }

    Ok(())
}

async fn ensure_shortcut_groups_table(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS shortcut_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_shortcut_groups_sort ON shortcut_groups(sort_order, name)",
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn backfill_shortcut_groups(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        "INSERT OR IGNORE INTO shortcut_groups (id, name, sort_order, created_at, updated_at)
         SELECT lower(hex(randomblob(16))), trim(group_name), 0, ?, ?
         FROM shortcuts
         WHERE trim(group_name) <> ''",
    )
    .bind(now_rfc3339())
    .bind(now_rfc3339())
    .execute(pool)
    .await?;
    Ok(())
}

async fn is_db_empty(pool: &SqlitePool) -> Result<bool> {
    let folders: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM folders")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    let connections: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM connections")
        .fetch_one(pool)
        .await
        .unwrap_or(0);
    Ok(folders == 0 && connections == 0)
}

async fn ensure_sync_state(pool: &SqlitePool) -> Result<()> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT 1 FROM sync_state WHERE id = 1")
        .fetch_optional(pool)
        .await?;
    if exists.is_none() {
        let device_id = legacy::generate_device_id();
        sqlx::query(
            "INSERT INTO sync_state (id, device_id, last_sync_revision, last_sync_at, local_dirty) VALUES (1, ?, 0, NULL, 0)",
        )
        .bind(device_id)
        .execute(pool)
        .await?;
    }
    Ok(())
}

fn find_legacy_dir(app: &tauri::AppHandle, active_root: &Path) -> Option<PathBuf> {
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

fn legacy_key_candidates(legacy_dir: &Option<PathBuf>) -> Option<PathBuf> {
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

fn migrate_old_db(legacy_dir: &Option<PathBuf>, new_db_path: &Path) -> Result<()> {
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
