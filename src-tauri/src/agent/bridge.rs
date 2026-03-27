use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::Executor;

use crate::db::Db;

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
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    let mut settings = Map::new();
    for (key, value) in rows {
        let parsed = serde_json::from_str::<Value>(&value).unwrap_or(Value::String(value));
        settings.insert(key, parsed);
    }
    Ok(settings)
}

pub async fn save_settings(db: &Db, payload: SaveSettingsPayload) -> Result<(), String> {
    let mut tx = db.pool.begin().await.map_err(|e| e.to_string())?;
    for (key, value) in payload.settings {
        if key.len() > 100 {
            continue;
        }
        let serialized = serde_json::to_string(&value).map_err(|e| e.to_string())?;
        if serialized.len() > 10_240 {
            continue;
        }
        tx.execute(
            sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
                .bind(key)
                .bind(serialized),
        )
        .await
        .map_err(|e| e.to_string())?;
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn reset_settings(db: &Db) -> Result<(), String> {
    sqlx::query("DELETE FROM settings")
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
