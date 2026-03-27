use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::db::Db;
use crate::time_utils::now_rfc3339;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ShortcutRecord {
    pub id: String,
    pub name: String,
    pub command: String,
    pub remark: String,
    pub group_name: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ShortcutGroupRecord {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateShortcutInput {
    pub name: String,
    pub command: String,
    pub remark: Option<String>,
    pub group_name: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateShortcutInput {
    pub name: Option<String>,
    pub command: Option<String>,
    pub remark: Option<String>,
    pub group_name: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateShortcutGroupInput {
    pub name: String,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateShortcutGroupInput {
    pub name: Option<String>,
    pub sort_order: Option<i64>,
}

async fn mark_local_dirty(db: &Db) -> Result<(), String> {
    sqlx::query("UPDATE sync_state SET local_dirty = 1 WHERE id = 1")
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn normalize_group_name(value: Option<String>) -> String {
    value.unwrap_or_default().trim().to_string()
}

async fn ensure_group_exists(db: &Db, group_name: &str) -> Result<(), String> {
    if group_name.is_empty() {
        return Ok(());
    }
    let now = now_rfc3339();
    sqlx::query(
        "INSERT OR IGNORE INTO shortcut_groups (id, name, sort_order, created_at, updated_at) VALUES (?, ?, 0, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(group_name)
    .bind(&now)
    .bind(&now)
    .execute(&db.pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn list_shortcuts(db: &Db) -> Result<Vec<ShortcutRecord>, String> {
    sqlx::query_as::<_, ShortcutRecord>(
        "SELECT id, name, command, remark, group_name, sort_order, created_at, updated_at FROM shortcuts ORDER BY sort_order ASC, name ASC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_shortcut(db: &Db, input: CreateShortcutInput) -> Result<ShortcutRecord, String> {
    let name = input.name.trim().to_string();
    let command = input.command.trim().to_string();
    if name.is_empty() || command.is_empty() {
        return Err("name 和 command 为必填项".to_string());
    }
    let group_name = normalize_group_name(input.group_name);
    ensure_group_exists(db, &group_name).await?;
    let now = now_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();
    let remark = input.remark.unwrap_or_default();
    let sort_order = input.sort_order.unwrap_or(0);
    sqlx::query("INSERT INTO shortcuts (id, name, command, remark, group_name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&command)
        .bind(&remark)
        .bind(&group_name)
        .bind(sort_order)
        .bind(&now)
        .bind(&now)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    mark_local_dirty(db).await?;
    Ok(ShortcutRecord {
        id,
        name,
        command,
        remark,
        group_name,
        sort_order,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub async fn update_shortcut(db: &Db, id: String, input: UpdateShortcutInput) -> Result<ShortcutRecord, String> {
    let existing = sqlx::query_as::<_, ShortcutRecord>(
        "SELECT id, name, command, remark, group_name, sort_order, created_at, updated_at FROM shortcuts WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;
    let Some(existing) = existing else {
        return Err("快捷命令不存在".to_string());
    };

    let name = input.name.unwrap_or(existing.name.clone());
    let command = input.command.unwrap_or(existing.command.clone());
    let remark = input.remark.unwrap_or(existing.remark.clone());
    let group_name = normalize_group_name(input.group_name.or(Some(existing.group_name.clone())));
    let sort_order = input.sort_order.unwrap_or(existing.sort_order);
    ensure_group_exists(db, &group_name).await?;
    let updated_at = now_rfc3339();

    sqlx::query("UPDATE shortcuts SET name = ?, command = ?, remark = ?, group_name = ?, sort_order = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(&command)
        .bind(&remark)
        .bind(&group_name)
        .bind(sort_order)
        .bind(&updated_at)
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    mark_local_dirty(db).await?;
    Ok(ShortcutRecord {
        id,
        name,
        command,
        remark,
        group_name,
        sort_order,
        created_at: existing.created_at,
        updated_at,
    })
}

pub async fn delete_shortcut(db: &Db, id: String) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM shortcuts WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("快捷命令不存在".to_string());
    }
    mark_local_dirty(db).await?;
    Ok(())
}

pub async fn list_shortcut_groups(db: &Db) -> Result<Vec<ShortcutGroupRecord>, String> {
    sqlx::query_as::<_, ShortcutGroupRecord>(
        "SELECT id, name, sort_order, created_at, updated_at FROM shortcut_groups ORDER BY sort_order ASC, name ASC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_shortcut_group(db: &Db, input: CreateShortcutGroupInput) -> Result<ShortcutGroupRecord, String> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("group name required".to_string());
    }
    let existing: Option<String> = sqlx::query_scalar("SELECT id FROM shortcut_groups WHERE name = ?")
        .bind(&name)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    if existing.is_some() {
        return Err("group already exists".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_rfc3339();
    let sort_order = input.sort_order.unwrap_or(0);
    sqlx::query("INSERT INTO shortcut_groups (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(sort_order)
        .bind(&now)
        .bind(&now)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    mark_local_dirty(db).await?;
    Ok(ShortcutGroupRecord {
        id,
        name,
        sort_order,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub async fn update_shortcut_group(
    db: &Db,
    id: String,
    input: UpdateShortcutGroupInput,
) -> Result<ShortcutGroupRecord, String> {
    let existing = sqlx::query_as::<_, ShortcutGroupRecord>(
        "SELECT id, name, sort_order, created_at, updated_at FROM shortcut_groups WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;
    let Some(existing) = existing else {
        return Err("group not found".to_string());
    };

    let name = input
        .name
        .map(|value| value.trim().to_string())
        .unwrap_or(existing.name.clone());
    if name.is_empty() {
        return Err("group name required".to_string());
    }
    let sort_order = input.sort_order.unwrap_or(existing.sort_order);
    let updated_at = now_rfc3339();

    sqlx::query("UPDATE shortcut_groups SET name = ?, sort_order = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(sort_order)
        .bind(&updated_at)
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    if name != existing.name {
        sqlx::query("UPDATE shortcuts SET group_name = ?, updated_at = ? WHERE group_name = ?")
            .bind(&name)
            .bind(&updated_at)
            .bind(&existing.name)
            .execute(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    mark_local_dirty(db).await?;
    Ok(ShortcutGroupRecord {
        id,
        name,
        sort_order,
        created_at: existing.created_at,
        updated_at,
    })
}

pub async fn delete_shortcut_group(db: &Db, id: String) -> Result<(), String> {
    let existing_name: Option<String> = sqlx::query_scalar("SELECT name FROM shortcut_groups WHERE id = ?")
        .bind(&id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    let Some(existing_name) = existing_name else {
        return Err("group not found".to_string());
    };
    let updated_at = now_rfc3339();
    sqlx::query("UPDATE shortcuts SET group_name = '', updated_at = ? WHERE group_name = ?")
        .bind(&updated_at)
        .bind(&existing_name)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM shortcut_groups WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    mark_local_dirty(db).await?;
    Ok(())
}
