/* ── Tauri 库入口：Commands 注册 ── */

mod commands;
mod server;

/// 内嵌 axum 服务器端口
const AXUM_PORT: u16 = 3002;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    tauri::Builder::default()
        // 插件
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        // Tauri Commands
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::list_system_fonts,
        ])
        // 启动时 spawn axum 服务器
        .setup(|_app| {
            let port = AXUM_PORT;
            tauri::async_runtime::spawn(async move {
                server::start(port).await;
            });
            tracing::info!("[Vortix] Tauri 应用启动完成");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}
