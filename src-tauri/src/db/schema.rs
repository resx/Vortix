use anyhow::Result;
use sqlx::{Row, SqlitePool};

use crate::db::legacy;
use crate::time_utils::now_rfc3339;

pub(super) async fn apply_pragmas(pool: &SqlitePool) -> Result<()> {
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

pub(super) async fn apply_migrations(pool: &SqlitePool) -> Result<()> {
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

pub(super) async fn repair_legacy_schema(pool: &SqlitePool) -> Result<()> {
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
            ("last_sync_remote_token", "TEXT NULL"),
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

pub(super) async fn is_db_empty(pool: &SqlitePool) -> Result<bool> {
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

pub(super) async fn ensure_sync_state(pool: &SqlitePool) -> Result<()> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT 1 FROM sync_state WHERE id = 1")
        .fetch_optional(pool)
        .await?;
    if exists.is_none() {
        let device_id = legacy::generate_device_id();
        sqlx::query(
            "INSERT INTO sync_state (id, device_id, last_sync_revision, last_sync_at, last_sync_remote_token, local_dirty) VALUES (1, ?, 0, NULL, NULL, 0)",
        )
        .bind(device_id)
        .execute(pool)
        .await?;
    }
    Ok(())
}
