use anyhow::Result;
use serde_json::Value;
use sqlx::{Row, SqlitePool};

use crate::time_utils::now_rfc3339;

const CACHE_TTL_SECONDS: i64 = 20;

pub async fn get_cached_listing(
    pool: &SqlitePool,
    session_key: &str,
    path: &str,
) -> Result<Option<Vec<Value>>> {
    let now_ts = chrono::Utc::now().timestamp();
    let row = sqlx::query(
        "SELECT payload
         FROM sftp_dir_cache
         WHERE session_key = ? AND path = ? AND expires_at > ?",
    )
    .bind(session_key)
    .bind(path)
    .bind(now_ts)
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Ok(None);
    };
    let payload: String = row.try_get("payload")?;
    let entries = serde_json::from_str::<Vec<Value>>(&payload).unwrap_or_default();
    Ok(Some(entries))
}

pub async fn set_cached_listing(
    pool: &SqlitePool,
    session_key: &str,
    path: &str,
    entries: &[Value],
) -> Result<()> {
    let payload = serde_json::to_string(entries)?;
    let expires_at = chrono::Utc::now().timestamp() + CACHE_TTL_SECONDS;
    sqlx::query(
        "INSERT INTO sftp_dir_cache (session_key, path, payload, expires_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(session_key, path)
         DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at, updated_at = excluded.updated_at",
    )
    .bind(session_key)
    .bind(path)
    .bind(payload)
    .bind(expires_at)
    .bind(now_rfc3339())
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn invalidate_path_and_parent(
    pool: &SqlitePool,
    session_key: &str,
    path: &str,
) -> Result<()> {
    invalidate_exact(pool, session_key, path).await?;
    if let Some(parent) = parent_dir(path) {
        invalidate_exact(pool, session_key, &parent).await?;
    }
    Ok(())
}

pub async fn invalidate_rename(
    pool: &SqlitePool,
    session_key: &str,
    old_path: &str,
    new_path: &str,
) -> Result<()> {
    invalidate_path_and_parent(pool, session_key, old_path).await?;
    invalidate_path_and_parent(pool, session_key, new_path).await?;
    sqlx::query(
        "DELETE FROM sftp_dir_cache
         WHERE session_key = ?
           AND (path LIKE ? OR path LIKE ?)",
    )
    .bind(session_key)
    .bind(format!("{}/%", trim_slash(old_path)))
    .bind(format!("{}/%", trim_slash(new_path)))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn clear_expired(pool: &SqlitePool) -> Result<()> {
    let now_ts = chrono::Utc::now().timestamp();
    sqlx::query("DELETE FROM sftp_dir_cache WHERE expires_at <= ?")
        .bind(now_ts)
        .execute(pool)
        .await?;
    Ok(())
}

async fn invalidate_exact(pool: &SqlitePool, session_key: &str, path: &str) -> Result<()> {
    sqlx::query("DELETE FROM sftp_dir_cache WHERE session_key = ? AND path = ?")
        .bind(session_key)
        .bind(path)
        .execute(pool)
        .await?;
    Ok(())
}

fn parent_dir(path: &str) -> Option<String> {
    let normalized = trim_slash(path);
    if normalized.is_empty() {
        return None;
    }
    if let Some(idx) = normalized.rfind('/') {
        if idx == 0 {
            return Some("/".to_string());
        }
        return Some(normalized[..idx].to_string());
    }
    Some("/".to_string())
}

fn trim_slash(path: &str) -> &str {
    if path == "/" {
        "/"
    } else {
        path.trim_end_matches('/')
    }
}
