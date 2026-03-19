/* ── axum 嵌入式 HTTP/WS 服务器 ── */

pub mod response;
pub mod types;
pub mod helpers;
pub mod routes;
pub mod ws;

use axum::Router;
use axum::http::Method;
use axum::routing::{get, post, put, delete};
use tower_http::cors::{Any, CorsLayer};

use crate::db::Db;

/// 启动嵌入式 axum 服务器
pub async fn start(port: u16, db: Db) {
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
        // 健康检查
        .route("/api/health", get(routes::health::health))
        // 设置
        .route("/api/settings", get(routes::settings::get_settings).put(routes::settings::update_settings))
        .route("/api/settings/reset", post(routes::settings::reset_settings))
        // 文件夹
        .route("/api/folders", get(routes::folders::get_folders).post(routes::folders::create_folder))
        .route("/api/folders/{id}", put(routes::folders::update_folder).delete(routes::folders::delete_folder))
        // 快捷命令
        .route("/api/shortcuts", get(routes::shortcuts::get_shortcuts).post(routes::shortcuts::create_shortcut))
        .route("/api/shortcuts/{id}", put(routes::shortcuts::update_shortcut).delete(routes::shortcuts::delete_shortcut))
        // 连接预设
        .route("/api/presets", get(routes::presets::get_presets).post(routes::presets::create_preset))
        .route("/api/presets/{id}", get(routes::presets::get_preset).put(routes::presets::update_preset).delete(routes::presets::delete_preset))
        .route("/api/presets/{id}/credential", get(routes::presets::get_preset_credential))
        // SSH 密钥
        .route("/api/ssh-keys", get(routes::ssh_keys::get_ssh_keys).post(routes::ssh_keys::create_ssh_key))
        .route("/api/ssh-keys/{id}", get(routes::ssh_keys::get_ssh_key).put(routes::ssh_keys::update_ssh_key).delete(routes::ssh_keys::delete_ssh_key))
        .route("/api/ssh-keys/{id}/private", get(routes::ssh_keys::get_ssh_key_private))
        .route("/api/ssh-keys/{id}/credential", get(routes::ssh_keys::get_ssh_key_credential))
        .route("/api/ssh-keys/{id}/export", get(routes::ssh_keys::export_ssh_key))
        .route("/api/ssh-keys/generate", post(routes::ssh_keys::generate_ssh_key))
        // 连接
        .route("/api/connections", get(routes::connections::get_connections).post(routes::connections::create_connection))
        .route("/api/connections/keys", get(routes::connections::get_connection_keys))
        .route("/api/connections/batch", axum::routing::patch(routes::connections::batch_update_connections))
        .route("/api/connections/ping", post(routes::connections::ping_connections))
        .route("/api/connections/test-ssh", post(routes::connections::test_ssh_connection))
        .route("/api/connections/test-local", post(routes::connections::test_local_terminal))
        .route("/api/connections/{id}", get(routes::connections::get_connection).put(routes::connections::update_connection).delete(routes::connections::delete_connection))
        .route("/api/connections/{id}/credential", get(routes::connections::get_connection_credential))
        .route("/api/connections/{id}/upload-key", post(routes::connections::upload_ssh_key))
        // 历史记录
        .route("/api/history/{connectionId}", get(routes::history::get_history).delete(routes::history::clear_history))
        .route("/api/history", post(routes::history::add_history))
        // 维护
        .route("/api/recent-connections", get(routes::maintenance::get_recent_connections))
        .route("/api/maintenance/cleanup", post(routes::maintenance::cleanup_orphan_data))
        .route("/api/maintenance/purge-all", post(routes::maintenance::purge_all_data))
        // 云同步
        .route("/api/sync/test", post(routes::sync::sync_test))
        .route("/api/sync/export", post(routes::sync::sync_export))
        .route("/api/sync/import", post(routes::sync::sync_import))
        .route("/api/sync/status", post(routes::sync::sync_status))
        .route("/api/sync/local-state", get(routes::sync::sync_local_state))
        .route("/api/sync/remote", delete(routes::sync::sync_delete_remote))
        .route("/api/sync/check-push", post(routes::sync::sync_check_push))
        .route("/api/sync/check-pull", post(routes::sync::sync_check_pull))
        // 主题
        .route("/api/themes", get(routes::themes::get_themes).post(routes::themes::create_theme))
        .route("/api/themes/{id}", get(routes::themes::get_theme).put(routes::themes::update_theme).delete(routes::themes::delete_theme))
        .route("/api/themes/import", post(routes::themes::import_theme))
        .route("/api/themes/{id}/export", get(routes::themes::export_theme))
        // 文件系统
        .route("/api/fs/list-dirs", get(routes::fs::list_dirs))
        .route("/api/fs/pick-dir", post(routes::fs::pick_dir))
        .route("/api/fs/pick-file", post(routes::fs::pick_file))
        .route("/api/fs/save-download", post(routes::fs::save_download))
        .route("/api/fs/open-local", post(routes::fs::open_local))
        .route("/api/fs/pick-save-path", post(routes::fs::pick_save_path))
        // 外部编辑器
        .route("/api/editor/open", post(routes::editor::open_editor))
        .route("/api/editor/temp-dir", get(routes::editor::get_temp_dir))
        // WebSocket
        .route("/ws/ssh", get(ws::ws_upgrade_ssh))
        .route("/ws/sftp", get(ws::ws_upgrade_sftp))
        .layer(cors)
        .with_state(db);

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
