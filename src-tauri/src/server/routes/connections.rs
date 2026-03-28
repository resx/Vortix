/* ── 连接 CRUD + 测试 + 密钥上传 ── */

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use russh::client::{self, Handler};
use russh::keys::{self, PrivateKeyWithHashAlg};
use serde_json::{Map, Value, json};

use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time;
use uuid::Uuid;

use super::super::helpers::{
    EstablishRusshSessionError, HostKeyConnectDecision, RusshAuthConfig, RusshEndpoint,
    RusshJumpHostConfig, authenticate_russh_handle, establish_russh_session,
    establish_russh_session_via_jump, format_private_key_parse_error, insert_connection,
    mark_local_dirty, to_connection_public, update_connection_row,
};
use super::super::response::{ApiResponse, err, ok, ok_empty};
use super::super::types::*;
use crate::db::Db;
use crate::server::ws::local_pty_worker::{
    local_shell_executable, resolve_local_shell_working_dir,
};
use crate::time_utils::now_rfc3339;

mod auth;
mod batch;
mod connectivity_ping;
mod connectivity_test;
mod key_upload;
mod key_upload_legacy;
mod local_terminal;
mod mutate;
mod read;
use auth::{
    resolve_connection_auth, resolve_jump_connection_payload, resolve_jump_host_config,
    resolve_jump_host_config_by_id, resolve_key_material,
};

pub async fn get_connections(
    db: State<Db>,
    query: Query<ConnectionListQuery>,
) -> Result<Json<ApiResponse<Vec<ConnectionPublic>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    read::get_connections(db, query).await
}

pub async fn get_connection(
    db: State<Db>,
    id: axum::extract::Path<String>,
) -> Result<Json<ApiResponse<ConnectionPublic>>, (StatusCode, Json<ApiResponse<Value>>)> {
    read::get_connection(db, id).await
}

pub async fn get_connection_credential(
    db: State<Db>,
    id: axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    read::get_connection_credential(db, id).await
}

pub async fn get_connection_keys(
    db: State<Db>,
) -> Result<Json<ApiResponse<Vec<ConnectionKeyInfo>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    read::get_connection_keys(db).await
}

pub async fn create_connection(
    db: State<Db>,
    body: Json<CreateConnectionDto>,
) -> Result<(StatusCode, Json<ApiResponse<ConnectionPublic>>), (StatusCode, Json<ApiResponse<Value>>)>
{
    mutate::create_connection(db, body).await
}

pub async fn update_connection(
    db: State<Db>,
    id: axum::extract::Path<String>,
    body: Json<Value>,
) -> Result<Json<ApiResponse<ConnectionPublic>>, (StatusCode, Json<ApiResponse<Value>>)> {
    mutate::update_connection(db, id, body).await
}

pub async fn delete_connection(
    db: State<Db>,
    id: axum::extract::Path<String>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    mutate::delete_connection(db, id).await
}

pub async fn batch_update_connections(
    db: State<Db>,
    body: Json<BatchUpdateConnectionsDto>,
) -> Result<Json<ApiResponse<Vec<ConnectionPublic>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    batch::batch_update_connections(db, body).await
}

pub async fn ping_connections(
    db: State<Db>,
    body: Json<Value>,
) -> Result<Json<ApiResponse<HashMap<String, Value>>>, (StatusCode, Json<ApiResponse<Value>>)> {
    connectivity_ping::ping_connections(db, body).await
}

#[allow(dead_code)]
pub async fn test_ssh_connection(
    db: State<Db>,
    body: Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    connectivity_test::test_ssh_connection(db, body).await
}

pub async fn test_ssh_connection_secure(
    db: State<Db>,
    body: Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    connectivity_test::test_ssh_connection_secure(db, body).await
}

pub async fn get_local_terminal_default_working_dir(
    db: State<Db>,
    body: Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    local_terminal::get_local_terminal_default_working_dir(db, body).await
}

pub async fn test_local_terminal(
    db: State<Db>,
    body: Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    local_terminal::test_local_terminal(db, body).await
}

pub async fn upload_ssh_key_secure(
    db: State<Db>,
    id: axum::extract::Path<String>,
    body: Json<Value>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    key_upload::upload_ssh_key_secure(db, id, body).await
}

#[allow(dead_code)]
pub async fn upload_ssh_key(
    db: State<Db>,
    id: axum::extract::Path<String>,
    body: Json<Value>,
) -> Result<Json<ApiResponse<Value>>, (StatusCode, Json<ApiResponse<Value>>)> {
    key_upload_legacy::upload_ssh_key(db, id, body).await
}
