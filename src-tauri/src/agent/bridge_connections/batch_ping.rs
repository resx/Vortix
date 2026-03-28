use serde_json::Map;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time;

use crate::db::Db;
use crate::server::helpers::{to_connection_public, update_connection_row};
use crate::server::types::{BatchUpdateConnectionsDto, ConnectionPublic, ConnectionRow};
use crate::time_utils::now_rfc3339;

use super::crud::mark_local_dirty;

pub async fn batch_update_connections(
    db: &Db,
    body: BatchUpdateConnectionsDto,
) -> Result<Vec<ConnectionPublic>, String> {
    if body.ids.is_empty() {
        return Err("ids 不能为空".to_string());
    }
    if body.ids.len() > 100 {
        return Err("批量操作不能超过 100 条".to_string());
    }
    let obj = body
        .updates
        .as_object()
        .ok_or_else(|| "updates 不能为空".to_string())?;

    let mut allowed = Map::new();
    for key in [
        "folder_id",
        "color_tag",
        "remark",
        "environment",
        "port",
        "username",
        "auth_type",
        "proxy_type",
        "proxy_host",
        "proxy_port",
        "proxy_username",
        "proxy_timeout",
        "jump_server_id",
        "env_vars",
        "advanced",
    ] {
        if let Some(v) = obj.get(key) {
            allowed.insert(key.to_string(), v.clone());
        }
    }

    let mut enc_pwd: Option<String> = None;
    let mut enc_proxy: Option<String> = None;
    if let Some(serde_json::Value::String(p)) = obj.get("password") {
        if !p.is_empty() {
            enc_pwd = Some(db.crypto.encrypt(p).map_err(|e| e.to_string())?);
        }
    }
    if let Some(serde_json::Value::String(p)) = obj.get("proxy_password") {
        if !p.is_empty() {
            enc_proxy = Some(db.crypto.encrypt(p).map_err(|e| e.to_string())?);
        }
    }
    if allowed.is_empty() && enc_pwd.is_none() && enc_proxy.is_none() {
        return Err("没有可更新的字段".to_string());
    }

    let mut results = Vec::new();
    for id in body.ids {
        let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
            .bind(&id)
            .fetch_optional(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
        let Some(mut row) = row else {
            continue;
        };

        for (key, value) in &allowed {
            match (key.as_str(), value) {
                ("folder_id", serde_json::Value::String(v)) => row.folder_id = Some(v.clone()),
                ("folder_id", serde_json::Value::Null) => row.folder_id = None,
                ("color_tag", serde_json::Value::String(v)) => row.color_tag = Some(v.clone()),
                ("color_tag", serde_json::Value::Null) => row.color_tag = None,
                ("remark", serde_json::Value::String(v)) => row.remark = v.clone(),
                ("environment", serde_json::Value::String(v)) => row.environment = v.clone(),
                ("port", serde_json::Value::Number(v)) => {
                    if let Some(p) = v.as_i64() {
                        row.port = p;
                    }
                }
                ("username", serde_json::Value::String(v)) => row.username = v.clone(),
                ("auth_type", serde_json::Value::String(v)) => row.auth_type = v.clone(),
                ("proxy_type", serde_json::Value::String(v)) => row.proxy_type = v.clone(),
                ("proxy_host", serde_json::Value::String(v)) => row.proxy_host = v.clone(),
                ("proxy_port", serde_json::Value::Number(v)) => {
                    if let Some(p) = v.as_i64() {
                        row.proxy_port = p;
                    }
                }
                ("proxy_username", serde_json::Value::String(v)) => row.proxy_username = v.clone(),
                ("proxy_timeout", serde_json::Value::Number(v)) => {
                    if let Some(p) = v.as_i64() {
                        row.proxy_timeout = p;
                    }
                }
                ("jump_server_id", serde_json::Value::String(v)) => row.jump_server_id = Some(v.clone()),
                ("jump_server_id", serde_json::Value::Null) => row.jump_server_id = None,
                ("env_vars", serde_json::Value::String(v)) => row.env_vars = v.clone(),
                ("advanced", serde_json::Value::String(v)) => row.advanced = v.clone(),
                _ => {}
            }
        }
        if let Some(ref p) = enc_pwd {
            row.encrypted_password = Some(p.clone());
        }
        if let Some(ref p) = enc_proxy {
            row.proxy_password = p.clone();
        }
        row.updated_at = now_rfc3339();
        update_connection_row(db, &row)
            .await
            .map_err(|e| e.1.error.clone().unwrap_or_else(|| "批量更新连接失败".to_string()))?;
        results.push(to_connection_public(row));
    }
    if !results.is_empty() {
        mark_local_dirty(db).await?;
    }
    Ok(results)
}

pub async fn ping_connections(db: &Db, ids: Vec<String>) -> Result<HashMap<String, Option<i64>>, String> {
    if ids.len() > 50 {
        return Err("批量 ping 数量不能超过 50".to_string());
    }
    if ids.is_empty() {
        return Ok(HashMap::new());
    }

    let mut tasks = Vec::new();
    for id in ids {
        let db = db.clone();
        tasks.push(tokio::spawn(async move {
            let row = sqlx::query_as::<_, ConnectionRow>("SELECT * FROM connections WHERE id = ?")
                .bind(&id)
                .fetch_optional(&db.pool)
                .await
                .ok()
                .flatten();
            if let Some(row) = row {
                if row.protocol == "local" || row.host.is_empty() {
                    return (id, None);
                }
                let start = Instant::now();
                let addr = format!("{}:{}", row.host, row.port);
                let ok = time::timeout(Duration::from_secs(5), TcpStream::connect(addr))
                    .await
                    .is_ok();
                if ok {
                    return (id, Some(start.elapsed().as_millis() as i64));
                }
            }
            (id, None)
        }));
    }

    let mut results = HashMap::new();
    for task in tasks {
        if let Ok((id, value)) = task.await {
            results.insert(id, value);
        }
    }
    Ok(results)
}
