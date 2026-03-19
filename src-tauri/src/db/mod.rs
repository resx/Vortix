/* ── SQLite 数据层初始化 + 旧 JSON 迁移 ── */

use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{SqlitePool, sqlite::{SqlitePoolOptions, SqliteConnectOptions}};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

use crate::crypto::Crypto;

mod legacy;
mod backup;

/// ~/.vortix 子目录名
const DIR_DB: &str = "db";
const DIR_KEYS: &str = "keys";
const DIR_BACKUPS: &str = "backups";
const DIR_LOGS: &str = "logs";
const DIR_SYNC: &str = "sync";
const DIR_CACHE: &str = "cache";

#[derive(Clone)]
pub struct Db {
    pub pool: SqlitePool,
    pub crypto: Crypto,
    pub paths: DbPaths,
    pub app_handle: tauri::AppHandle,
}

#[derive(Clone)]
pub struct DbPaths {
    /// ~/.vortix
    pub root_dir: PathBuf,
    /// ~/.vortix/db/vortix.db
    pub db_path: PathBuf,
    /// ~/.vortix/backups/
    pub backup_dir: PathBuf,
    /// ~/.vortix/keys/encryption.key
    pub key_path: PathBuf,
    /// ~/.vortix/logs/
    pub log_dir: PathBuf,
    /// ~/.vortix/sync/
    pub sync_dir: PathBuf,
    /// ~/.vortix/cache/
    pub cache_dir: PathBuf,
    /// 旧数据目录（迁移用）
    pub legacy_dir: Option<PathBuf>,
}

/// 获取 ~/.vortix 根目录
fn resolve_vortix_home() -> Result<PathBuf> {
    // 优先使用环境变量覆盖（方便测试/开发）
    if let Ok(value) = std::env::var("VORTIX_HOME") {
        return Ok(PathBuf::from(value));
    }
    // Windows: C:\Users\<user>\.vortix
    // macOS/Linux: /home/<user>/.vortix
    match dirs::home_dir() {
        Some(home) => Ok(home.join(".vortix")),
        None => {
            // 回退：使用系统临时目录
            tracing::warn!("[Vortix] 无法获取用户主目录，回退到临时目录");
            Ok(std::env::temp_dir().join(".vortix"))
        }
    }
}

/// 创建所有子目录
fn ensure_dirs(root: &PathBuf) -> Result<()> {
    for sub in [DIR_DB, DIR_KEYS, DIR_BACKUPS, DIR_LOGS, DIR_SYNC, DIR_CACHE] {
        fs::create_dir_all(root.join(sub))
            .with_context(|| format!("创建目录失败: {}", root.join(sub).display()))?;
    }
    Ok(())
}

pub async fn init(app: &tauri::AppHandle) -> Result<Db> {
    let root_dir = resolve_vortix_home()?;
    tracing::info!("[Vortix] 数据根目录: {}", root_dir.display());
    ensure_dirs(&root_dir)?;

    let db_path = root_dir.join(DIR_DB).join("vortix.db");
    let key_path = root_dir.join(DIR_KEYS).join("encryption.key");
    let backup_dir = root_dir.join(DIR_BACKUPS);
    let log_dir = root_dir.join(DIR_LOGS);
    let sync_dir = root_dir.join(DIR_SYNC);
    let cache_dir = root_dir.join(DIR_CACHE);

    // 旧数据迁移：检查 Tauri AppData、项目根目录 data/、旧 ~/.vortix 平铺文件
    let legacy_dir = find_legacy_dir(app);
    let legacy_key_path = legacy_key_candidates(&legacy_dir, &root_dir);
    let crypto = Crypto::load_or_migrate(&key_path, legacy_key_path.as_deref())
        .context("初始化加密密钥失败")?;

    // 如果旧位置有 db 文件但新位置没有，自动迁移
    migrate_old_db(&legacy_dir, &root_dir, &db_path)?;

    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .with_context(|| format!("连接 SQLite 失败: {}", db_path.display()))?;

    apply_pragmas(&pool).await?;
    apply_migrations(&pool).await?;
    ensure_sync_state(&pool).await?;

    let is_empty = is_db_empty(&pool).await?;
    if is_empty {
        if let Some(legacy) = legacy_dir.as_ref() {
            if legacy::has_legacy_data(legacy) {
                let summary = legacy::import_all(legacy, &pool).await?;
                legacy::archive_legacy_data(legacy)?;
                tracing::info!(
                    "[Vortix] 已导入旧数据: folders={}, connections={}, shortcuts={}, ssh_keys={}, presets={}, history={}, logs={}, themes={}, settings={}",
                    summary.folders, summary.connections, summary.shortcuts,
                    summary.ssh_keys, summary.presets, summary.history,
                    summary.logs, summary.themes, summary.settings,
                );
            }
        }
    }

    tracing::info!("[Vortix] 数据目录: {}", root_dir.display());

    Ok(Db {
        pool,
        crypto,
        paths: DbPaths {
            root_dir,
            db_path,
            backup_dir,
            key_path,
            log_dir,
            sync_dir,
            cache_dir,
            legacy_dir,
        },
        app_handle: app.clone(),
    })
}

pub async fn export_backup(db: &Db) -> Result<()> {
    let backup_path = db.paths.backup_dir.join(format!(
        "vortix-backup-{}.json",
        Utc::now().format("%Y%m%d_%H%M%S")
    ));
    backup::export_to_json(&db.pool, &backup_path).await
}

async fn apply_pragmas(pool: &SqlitePool) -> Result<()> {
    sqlx::query("PRAGMA journal_mode = WAL;").execute(pool).await?;
    sqlx::query("PRAGMA synchronous = NORMAL;").execute(pool).await?;
    sqlx::query("PRAGMA foreign_keys = ON;").execute(pool).await?;
    sqlx::query("PRAGMA temp_store = MEMORY;").execute(pool).await?;
    Ok(())
}

async fn apply_migrations(pool: &SqlitePool) -> Result<()> {
    sqlx::migrate!("./migrations").run(pool).await?;

    let version: i64 = 1;
    let applied_at = Utc::now().to_rfc3339();
    sqlx::query("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .bind(version)
        .bind(applied_at)
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
        sqlx::query("INSERT INTO sync_state (id, device_id, last_sync_revision, last_sync_at, local_dirty) VALUES (1, ?, 0, NULL, 0)")
            .bind(device_id)
            .execute(pool)
            .await?;
    }
    Ok(())
}

/// 查找旧数据目录（按优先级）
fn find_legacy_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    // 1. 环境变量覆盖
    if let Ok(value) = std::env::var("VORTIX_LEGACY_DATA_DIR") {
        let p = PathBuf::from(value);
        if p.exists() { return Some(p); }
    }

    // 2. 旧 Tauri AppData 目录（可能有之前版本的数据）
    if let Ok(app_data) = app.path().app_data_dir() {
        if app_data.join("vortix.db").exists() || app_data.join("encryption.key").exists() {
            return Some(app_data);
        }
    }

    // 3. 项目根目录 data/（Node.js 遗留）
    let cwd = std::env::current_dir().ok()?;
    let direct = cwd.join("data");
    if direct.exists() { return Some(direct); }

    let parent = cwd.join("..").join("data");
    if parent.exists() { return Some(parent); }

    None
}

/// 查找旧加密密钥路径
fn legacy_key_candidates(legacy_dir: &Option<PathBuf>, root_dir: &PathBuf) -> Option<PathBuf> {
    // 旧目录中的 encryption.key
    if let Some(dir) = legacy_dir {
        let key = dir.join("encryption.key");
        if key.exists() { return Some(key); }
    }
    // ~/.vortix 根目录下的平铺 key（旧版可能直接放在根目录）
    let flat_key = root_dir.join("encryption.key");
    if flat_key.exists() { return Some(flat_key); }
    None
}

/// 从旧位置迁移 SQLite 数据库文件
fn migrate_old_db(legacy_dir: &Option<PathBuf>, root_dir: &PathBuf, new_db_path: &PathBuf) -> Result<()> {
    if new_db_path.exists() { return Ok(()); }

    // 检查旧位置的 db 文件
    let candidates = [
        legacy_dir.as_ref().map(|d| d.join("vortix.db")),
        Some(root_dir.join("vortix.db")),  // ~/.vortix/vortix.db（平铺旧版）
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            tracing::info!("[Vortix] 迁移数据库: {} → {}", candidate.display(), new_db_path.display());
            fs::copy(&candidate, new_db_path)
                .with_context(|| format!("迁移数据库失败: {}", candidate.display()))?;
            // 同时迁移 WAL/SHM 文件
            for ext in ["db-wal", "db-shm"] {
                let old = candidate.with_extension(ext);
                if old.exists() {
                    let new = new_db_path.with_extension(ext);
                    let _ = fs::copy(&old, &new);
                }
            }
            return Ok(());
        }
    }
    Ok(())
}
