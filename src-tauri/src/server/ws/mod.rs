/* WebSocket module: SSH terminal / local terminal / SFTP */

pub mod local_pty_worker;
pub mod sftp_worker;
pub mod ssh_worker;
mod socket_handlers;

use axum::extract::{State, ws::WebSocketUpgrade};
use axum::response::IntoResponse;
use serde::Deserialize;
use serde_json::Value;

use crate::db::Db;
use socket_handlers::{ws_sftp, ws_ssh};

#[derive(Deserialize)]
pub struct WsMessage {
    pub r#type: String,
    pub data: Option<Value>,
    #[serde(rename = "requestId")]
    pub request_id: Option<String>,
}

pub async fn ws_upgrade_ssh(State(db): State<Db>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_ssh(socket, db))
}

pub async fn ws_upgrade_sftp(State(db): State<Db>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_sftp(socket, db))
}
