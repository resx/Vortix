use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::db::Db;
use crate::time_utils::now_rfc3339;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct FolderRecord {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateFolderInput {
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateFolderInput {
    pub name: Option<String>,
    pub parent_id: Option<Option<String>>,
    pub sort_order: Option<i64>,
}

async fn mark_local_dirty(db: &Db) -> Result<(), String> {
    sqlx::query("UPDATE sync_state SET local_dirty = 1 WHERE id = 1")
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn list_folders(db: &Db) -> Result<Vec<FolderRecord>, String> {
    sqlx::query_as::<_, FolderRecord>(
        "SELECT id, name, parent_id, sort_order, created_at, updated_at FROM folders ORDER BY sort_order ASC, name ASC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| e.to_string())
}

pub async fn create_folder(db: &Db, input: CreateFolderInput) -> Result<FolderRecord, String> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("文件夹名称不能为空".to_string());
    }
    if name.len() > 255 {
        return Err("文件夹名称长度不能超过 255".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_rfc3339();
    let sort_order = input.sort_order.unwrap_or(0);
    sqlx::query(
        "INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&input.parent_id)
    .bind(sort_order)
    .bind(&now)
    .bind(&now)
    .execute(&db.pool)
    .await
    .map_err(|e| e.to_string())?;
    mark_local_dirty(db).await?;
    Ok(FolderRecord {
        id,
        name,
        parent_id: input.parent_id,
        sort_order,
        created_at: now.clone(),
        updated_at: now,
    })
}

pub async fn update_folder(db: &Db, id: String, input: UpdateFolderInput) -> Result<FolderRecord, String> {
    let existing = sqlx::query_as::<_, FolderRecord>(
        "SELECT id, name, parent_id, sort_order, created_at, updated_at FROM folders WHERE id = ?",
    )
    .bind(&id)
    .fetch_optional(&db.pool)
    .await
    .map_err(|e| e.to_string())?;
    let Some(existing) = existing else {
        return Err("文件夹不存在".to_string());
    };

    let name = input.name.unwrap_or(existing.name.clone());
    let parent_id = input.parent_id.unwrap_or(existing.parent_id.clone());
    let sort_order = input.sort_order.unwrap_or(existing.sort_order);
    let updated_at = now_rfc3339();

    sqlx::query("UPDATE folders SET name = ?, parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?")
        .bind(&name)
        .bind(&parent_id)
        .bind(sort_order)
        .bind(&updated_at)
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    mark_local_dirty(db).await?;
    Ok(FolderRecord {
        id,
        name,
        parent_id,
        sort_order,
        created_at: existing.created_at,
        updated_at,
    })
}

pub async fn delete_folder(db: &Db, id: String) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM folders WHERE id = ?")
        .bind(&id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    if result.rows_affected() == 0 {
        return Err("文件夹不存在".to_string());
    }
    mark_local_dirty(db).await?;
    Ok(())
}
