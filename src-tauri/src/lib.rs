/* ── Tauri 库入口：Commands 注册 + 动态窗口尺寸 ── */

mod commands;
mod server;

use tauri::Manager;

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

#[cfg(target_os = "windows")]
use window_vibrancy::apply_blur;

/// 内嵌 axum 服务器端口
const AXUM_PORT: u16 = 3002;

/// 窗口尺寸约束（逻辑像素）
const MIN_WIDTH: f64 = 1100.0;
const MIN_HEIGHT: f64 = 700.0;
const MAX_WIDTH: f64 = 2560.0;
const MAX_HEIGHT: f64 = 1600.0;

/// 根据主显示器逻辑工作区动态计算初始窗口尺寸（逻辑像素）
/// 宽度取逻辑屏幕宽度的 74%，高度取 78%，夹紧到 [MIN, MAX] 范围
fn calculate_initial_size(monitor: &tauri::Monitor) -> tauri::LogicalSize<f64> {
    let physical = monitor.size();
    let scale = monitor.scale_factor();

    // 物理像素 → 逻辑像素
    let logical_w = physical.width as f64 / scale;
    let logical_h = physical.height as f64 / scale;

    // 扣除任务栏/Dock 的近似高度（逻辑像素）
    let taskbar_offset = 48.0;
    let available_h = logical_h - taskbar_offset;

    let init_w = (logical_w * 0.74).round().clamp(MIN_WIDTH, MAX_WIDTH);
    let init_h = (available_h * 0.78).round().clamp(MIN_HEIGHT, MAX_HEIGHT);

    tracing::info!(
        "[Vortix] 显示器: {}×{} 物理, scale={scale:.2}, 逻辑={logical_w:.0}×{logical_h:.0} → 初始窗口={init_w:.0}×{init_h:.0}",
        physical.width, physical.height
    );

    tauri::LogicalSize::new(init_w, init_h)
}

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
        // 启动时：动态窗口尺寸 + 窗口效果 + axum 服务器
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // ── 动态窗口尺寸 ──
            if let Ok(Some(monitor)) = window.current_monitor() {
                let size = calculate_initial_size(&monitor);
                let _ = window.set_size(size);
                let _ = window.center();
            }

            // ── 窗口视觉效果 ──
            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            #[cfg(target_os = "windows")]
            apply_blur(&window, Some((18, 18, 18, 125)))
                .expect("Unsupported platform! 'apply_blur' is only supported on Windows");

            // ── 内嵌 axum 服务器 ──
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
