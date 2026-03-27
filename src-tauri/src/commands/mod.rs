/* ── Tauri Commands ── */

use font_kit::source::SystemSource;
use serde_json::{Map, Value};
use tauri::AppHandle;
use tauri::State;

use crate::agent::bridge::{self, BridgeHealth, SaveSettingsPayload};
use crate::agent::bridge_connections as connection_bridge;
use crate::agent::bridge_folders as folder_bridge;
use crate::agent::bridge_shortcuts as shortcut_bridge;
use crate::agent::{AgentState, AgentStatus};
use crate::db::Db;
use crate::sftp_bridge::{BridgeClientMessage as SftpBridgeClientMessage, SftpBridgeHub};
use crate::terminal_bridge::{BridgeClientMessage, TerminalBridgeHub};

/// PoC 验证用：简单问候命令
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("你好, {}! 来自 Vortix Rust 后端", name)
}

/// 枚举系统已安装的字体族名称
#[tauri::command]
pub fn list_system_fonts() -> Vec<String> {
    match SystemSource::new().all_families() {
        Ok(mut families) => {
            families.sort_unstable();
            families.dedup();
            families
        }
        Err(e) => {
            tracing::warn!("[Vortix] 系统字体枚举失败: {e}");
            Vec::new()
        }
    }
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn get_agent_status(agent: State<'_, AgentState>) -> Result<AgentStatus, String> {
    Ok(agent.status())
}

#[tauri::command]
pub async fn bridge_health() -> Result<BridgeHealth, String> {
    Ok(bridge::health().await)
}

#[tauri::command]
pub async fn bridge_get_settings(db: State<'_, Db>) -> Result<Map<String, Value>, String> {
    bridge::get_settings(&db).await
}

#[tauri::command]
pub async fn bridge_save_settings(
    db: State<'_, Db>,
    payload: SaveSettingsPayload,
) -> Result<(), String> {
    bridge::save_settings(&db, payload).await
}

#[tauri::command]
pub async fn bridge_reset_settings(db: State<'_, Db>) -> Result<(), String> {
    bridge::reset_settings(&db).await
}

#[tauri::command]
pub async fn bridge_list_folders(db: State<'_, Db>) -> Result<Vec<folder_bridge::FolderRecord>, String> {
    folder_bridge::list_folders(&db).await
}

#[tauri::command]
pub async fn bridge_create_folder(
    db: State<'_, Db>,
    payload: folder_bridge::CreateFolderInput,
) -> Result<folder_bridge::FolderRecord, String> {
    folder_bridge::create_folder(&db, payload).await
}

#[tauri::command]
pub async fn bridge_update_folder(
    db: State<'_, Db>,
    id: String,
    payload: folder_bridge::UpdateFolderInput,
) -> Result<folder_bridge::FolderRecord, String> {
    folder_bridge::update_folder(&db, id, payload).await
}

#[tauri::command]
pub async fn bridge_delete_folder(db: State<'_, Db>, id: String) -> Result<(), String> {
    folder_bridge::delete_folder(&db, id).await
}

#[tauri::command]
pub async fn bridge_list_shortcuts(db: State<'_, Db>) -> Result<Vec<shortcut_bridge::ShortcutRecord>, String> {
    shortcut_bridge::list_shortcuts(&db).await
}

#[tauri::command]
pub async fn bridge_create_shortcut(
    db: State<'_, Db>,
    payload: shortcut_bridge::CreateShortcutInput,
) -> Result<shortcut_bridge::ShortcutRecord, String> {
    shortcut_bridge::create_shortcut(&db, payload).await
}

#[tauri::command]
pub async fn bridge_update_shortcut(
    db: State<'_, Db>,
    id: String,
    payload: shortcut_bridge::UpdateShortcutInput,
) -> Result<shortcut_bridge::ShortcutRecord, String> {
    shortcut_bridge::update_shortcut(&db, id, payload).await
}

#[tauri::command]
pub async fn bridge_delete_shortcut(db: State<'_, Db>, id: String) -> Result<(), String> {
    shortcut_bridge::delete_shortcut(&db, id).await
}

#[tauri::command]
pub async fn bridge_list_shortcut_groups(
    db: State<'_, Db>,
) -> Result<Vec<shortcut_bridge::ShortcutGroupRecord>, String> {
    shortcut_bridge::list_shortcut_groups(&db).await
}

#[tauri::command]
pub async fn bridge_create_shortcut_group(
    db: State<'_, Db>,
    payload: shortcut_bridge::CreateShortcutGroupInput,
) -> Result<shortcut_bridge::ShortcutGroupRecord, String> {
    shortcut_bridge::create_shortcut_group(&db, payload).await
}

#[tauri::command]
pub async fn bridge_update_shortcut_group(
    db: State<'_, Db>,
    id: String,
    payload: shortcut_bridge::UpdateShortcutGroupInput,
) -> Result<shortcut_bridge::ShortcutGroupRecord, String> {
    shortcut_bridge::update_shortcut_group(&db, id, payload).await
}

#[tauri::command]
pub async fn bridge_delete_shortcut_group(db: State<'_, Db>, id: String) -> Result<(), String> {
    shortcut_bridge::delete_shortcut_group(&db, id).await
}

#[tauri::command]
pub async fn bridge_list_connections(
    db: State<'_, Db>,
    query: Option<connection_bridge::ListConnectionsQuery>,
) -> Result<Vec<crate::server::types::ConnectionPublic>, String> {
    connection_bridge::list_connections(&db, query).await
}

#[tauri::command]
pub async fn bridge_get_connection(
    db: State<'_, Db>,
    id: String,
) -> Result<crate::server::types::ConnectionPublic, String> {
    connection_bridge::get_connection(&db, id).await
}

#[tauri::command]
pub async fn bridge_get_connection_credential(
    db: State<'_, Db>,
    id: String,
) -> Result<connection_bridge::ConnectionCredentialRecord, String> {
    connection_bridge::get_connection_credential(&db, id).await
}

#[tauri::command]
pub async fn bridge_create_connection(
    db: State<'_, Db>,
    payload: crate::server::types::CreateConnectionDto,
) -> Result<crate::server::types::ConnectionPublic, String> {
    connection_bridge::create_connection(&db, payload).await
}

#[tauri::command]
pub async fn bridge_update_connection(
    db: State<'_, Db>,
    id: String,
    payload: Value,
) -> Result<crate::server::types::ConnectionPublic, String> {
    connection_bridge::update_connection(&db, id, payload).await
}

#[tauri::command]
pub async fn bridge_delete_connection(db: State<'_, Db>, id: String) -> Result<(), String> {
    connection_bridge::delete_connection(&db, id).await
}

#[tauri::command]
pub async fn bridge_batch_update_connections(
    db: State<'_, Db>,
    payload: crate::server::types::BatchUpdateConnectionsDto,
) -> Result<Vec<crate::server::types::ConnectionPublic>, String> {
    connection_bridge::batch_update_connections(&db, payload).await
}

#[tauri::command]
pub async fn bridge_ping_connections(
    db: State<'_, Db>,
    ids: Vec<String>,
) -> Result<std::collections::HashMap<String, Option<i64>>, String> {
    connection_bridge::ping_connections(&db, ids).await
}

#[tauri::command]
pub fn bridge_terminal_open(
    app: AppHandle,
    db: State<'_, Db>,
    hub: State<'_, TerminalBridgeHub>,
    session_id: String,
) -> Result<(), String> {
    hub.open(app, db.inner().clone(), session_id)
}

#[tauri::command]
pub fn bridge_terminal_send(
    hub: State<'_, TerminalBridgeHub>,
    session_id: String,
    payload: BridgeClientMessage,
) -> Result<(), String> {
    hub.send(&session_id, payload)
}

#[tauri::command]
pub fn bridge_terminal_close(
    hub: State<'_, TerminalBridgeHub>,
    session_id: String,
) -> Result<(), String> {
    hub.close(&session_id)
}

#[tauri::command]
pub fn bridge_sftp_open(
    app: AppHandle,
    db: State<'_, Db>,
    hub: State<'_, SftpBridgeHub>,
    session_id: String,
) -> Result<(), String> {
    hub.open(app, db.inner().clone(), session_id)
}

#[tauri::command]
pub fn bridge_sftp_send(
    hub: State<'_, SftpBridgeHub>,
    session_id: String,
    payload: SftpBridgeClientMessage,
) -> Result<(), String> {
    hub.send(&session_id, payload)
}

#[tauri::command]
pub fn bridge_sftp_close(
    hub: State<'_, SftpBridgeHub>,
    session_id: String,
) -> Result<(), String> {
    hub.close(&session_id)
}
