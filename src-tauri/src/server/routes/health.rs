/* ── 健康检查 ── */

use axum::response::Json;
use serde_json::json;

pub async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "success": true,
        "data": { "status": "ok", "engine": "rust/axum" }
    }))
}
