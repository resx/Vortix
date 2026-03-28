use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::Executor;

use crate::{
    db::Db,
    server::helpers::{
        json_maps_equal_unordered, load_settings_map, merge_settings_updates,
        prepare_settings_updates,
    },
    sync::service::mark_sync_dirty,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeHealth {
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SaveSettingsPayload {
    pub settings: Map<String, Value>,
}

pub async fn health() -> BridgeHealth {
    BridgeHealth {
        status: "ok".to_string(),
    }
}

pub async fn get_settings(db: &Db) -> Result<Map<String, Value>, String> {
    load_settings_map(db).await
}

pub async fn save_settings(db: &Db, payload: SaveSettingsPayload) -> Result<(), String> {
    let current = load_settings_map(db).await?;
    let prepared = prepare_settings_updates(&payload.settings)?;
    let next = merge_settings_updates(&current, &prepared.effective_values);
    if json_maps_equal_unordered(&current, &next) {
        return Ok(());
    }

    let mut tx = db.pool.begin().await.map_err(|e| e.to_string())?;
    for (key, serialized) in prepared.serialized_entries {
        tx.execute(
            sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
                .bind(key)
                .bind(serialized),
        )
        .await
        .map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    mark_sync_dirty(db).await?;
    Ok(())
}

pub async fn reset_settings(db: &Db) -> Result<(), String> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM settings")
        .fetch_one(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    if count == 0 {
        return Ok(());
    }
    sqlx::query("DELETE FROM settings")
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    mark_sync_dirty(db).await?;
    Ok(())
}
