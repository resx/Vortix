use serde_json::{Map, Value};

use crate::db::Db;

const MAX_SETTING_KEY_LEN: usize = 100;
const MAX_SETTING_VALUE_LEN: usize = 10_240;

pub struct PreparedSettingsUpdates {
    pub serialized_entries: Vec<(String, String)>,
    pub effective_values: Map<String, Value>,
}

pub async fn load_settings_map(db: &Db) -> Result<Map<String, Value>, String> {
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

pub fn prepare_settings_updates(
    settings: &Map<String, Value>,
) -> Result<PreparedSettingsUpdates, String> {
    let mut effective_values = Map::new();
    let mut serialized_entries = Vec::new();
    for (key, value) in settings {
        if key.len() > MAX_SETTING_KEY_LEN {
            continue;
        }
        let serialized = serde_json::to_string(value).map_err(|e| e.to_string())?;
        if serialized.len() > MAX_SETTING_VALUE_LEN {
            continue;
        }
        effective_values.insert(key.clone(), value.clone());
        serialized_entries.push((key.clone(), serialized));
    }
    Ok(PreparedSettingsUpdates {
        serialized_entries,
        effective_values,
    })
}

pub fn merge_settings_updates(
    current: &Map<String, Value>,
    updates: &Map<String, Value>,
) -> Map<String, Value> {
    let mut merged = current.clone();
    for (key, value) in updates {
        merged.insert(key.clone(), value.clone());
    }
    merged
}
