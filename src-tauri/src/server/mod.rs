/* ── axum 嵌入式 HTTP/WS 服务器 ── */

use axum::{
    Router,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    http::Method,
    response::{IntoResponse, Json},
    routing::get,
};
use serde_json::json;
use tower_http::cors::{Any, CorsLayer};

/// 健康检查端点
async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "success": true,
        "data": { "status": "ok", "engine": "rust/axum" }
    }))
}

/// WebSocket echo（PoC 验证用）
async fn ws_upgrade(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(ws_echo)
}

async fn ws_echo(mut socket: WebSocket) {
    while let Some(Ok(msg)) = socket.recv().await {
        if let Message::Text(text) = msg {
            let reply = json!({ "echo": text.to_string() });
            if socket
                .send(Message::Text(reply.to_string().into()))
                .await
                .is_err()
            {
                break;
            }
        }
    }
}

/// 启动嵌入式 axum 服务器
pub async fn start(port: u16) {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
        ])
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/ws/ssh", get(ws_upgrade))
        .route("/ws/sftp", get(ws_upgrade))
        .layer(cors);

    let addr = format!("127.0.0.1:{port}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| {
            tracing::error!("端口 {port} 绑定失败: {e}");
            std::process::exit(1);
        });

    tracing::info!("[Vortix] axum 服务器启动: http://{addr}");
    axum::serve(listener, app).await.unwrap();
}
