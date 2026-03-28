use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(FromRow, Serialize)]
pub struct FolderRow {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateFolderDto {
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(FromRow, Serialize)]
pub struct ShortcutRow {
    pub id: String,
    pub name: String,
    pub command: String,
    pub remark: String,
    pub group_name: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateShortcutDto {
    pub name: String,
    pub command: String,
    pub remark: Option<String>,
    pub group_name: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(FromRow, Serialize)]
pub struct ShortcutGroupRow {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateShortcutGroupDto {
    pub name: String,
    pub sort_order: Option<i64>,
}
