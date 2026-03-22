use axum::{extract::State, response::Json};
use serde_json::Value;

use crate::db::Db;
use crate::server::response::{ApiError, ApiResponse};
use crate::server::types::{
    RemoteCheckResult, SyncConflictInfo, SyncFileInfo, SyncImportResult, SyncLocalState,
    SyncRequestBody,
};
use crate::sync;

pub async fn sync_test(
    State(db): State<Db>,
    Json(body): Json<SyncRequestBody>,
) -> Result<Json<ApiResponse<Value>>, ApiError> {
    sync::sync_test(db, body).await
}

pub async fn sync_status(
    State(db): State<Db>,
    Json(body): Json<SyncRequestBody>,
) -> Result<Json<ApiResponse<SyncFileInfo>>, ApiError> {
    sync::sync_status(db, body).await
}

pub async fn sync_local_state(
    State(db): State<Db>,
) -> Result<Json<ApiResponse<SyncLocalState>>, ApiError> {
    sync::sync_local_state(db).await
}

pub async fn sync_export(
    State(db): State<Db>,
    Json(body): Json<SyncRequestBody>,
) -> Result<Json<ApiResponse<Value>>, ApiError> {
    sync::sync_export(db, body).await
}

pub async fn sync_import(
    State(db): State<Db>,
    Json(body): Json<SyncRequestBody>,
) -> Result<Json<ApiResponse<SyncImportResult>>, ApiError> {
    sync::sync_import(db, body).await
}

pub async fn sync_delete_remote(
    State(db): State<Db>,
    Json(body): Json<SyncRequestBody>,
) -> Result<Json<ApiResponse<Value>>, ApiError> {
    sync::sync_delete_remote(db, body).await
}

pub async fn sync_check_push(
    State(db): State<Db>,
    Json(body): Json<SyncRequestBody>,
) -> Result<Json<ApiResponse<SyncConflictInfo>>, ApiError> {
    sync::sync_check_push(db, body).await
}

pub async fn sync_check_pull(
    State(db): State<Db>,
    Json(body): Json<SyncRequestBody>,
) -> Result<Json<ApiResponse<SyncConflictInfo>>, ApiError> {
    sync::sync_check_pull(db, body).await
}

pub async fn sync_check_remote(
    State(db): State<Db>,
    Json(body): Json<SyncRequestBody>,
) -> Result<Json<ApiResponse<RemoteCheckResult>>, ApiError> {
    sync::sync_check_remote(db, body).await
}
