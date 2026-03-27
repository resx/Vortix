/* ── Tauri 库入口：Commands 注册 + 动态窗口尺寸 ── */

mod commands;
mod agent;
mod crypto;
mod db;
mod server;
mod sftp_bridge;
mod sync;
mod terminal_bridge;
mod time_utils;

use tauri::Manager;

#[cfg(target_os = "macos")]
use window_vibrancy::{NSVisualEffectMaterial, apply_vibrancy};

#[cfg(target_os = "windows")]
fn suppress_windows_error_dialogs() {
    type WinDword = u32;
    type WinHresult = i32;

    const SEM_FAILCRITICALERRORS: WinDword = 0x0001;
    const SEM_NOGPFAULTERRORBOX: WinDword = 0x0002;
    const WER_FAULT_REPORTING_FLAG_QUEUE: WinDword = 0x0002;

    unsafe extern "system" {
        fn SetErrorMode(uMode: WinDword) -> WinDword;
        fn WerSetFlags(dwFlags: WinDword) -> WinHresult;
    }

    unsafe {
        let mode = SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
        let _ = SetErrorMode(mode | SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
        let _ = WerSetFlags(WER_FAULT_REPORTING_FLAG_QUEUE);
    }
}

#[cfg(target_os = "windows")]
fn harden_windows_webview<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    use webview2_com::{
        Microsoft::Web::WebView2::Win32::{
            COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ,
            COREWEBVIEW2_PERMISSION_KIND_LOCAL_FONTS,
            COREWEBVIEW2_PERMISSION_STATE_ALLOW, COREWEBVIEW2_PERMISSION_STATE_DENY,
            ICoreWebView2Settings3,
        },
        PermissionRequestedEventHandler,
    };
    use windows::core::Interface;

    let _ = window.with_webview(|webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else {
            return;
        };

        if let Ok(settings) = core.Settings() {
            let _ = settings.SetAreDevToolsEnabled(false);
            let _ = settings.SetAreDefaultContextMenusEnabled(false);
            if let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() {
                let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
            }
        }

        let mut token = 0i64;
        let _ = core.add_PermissionRequested(
            &PermissionRequestedEventHandler::create(Box::new(|_, args| {
                let Some(args) = args else {
                    return Ok(());
                };

                let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
                args.PermissionKind(&mut kind)?;
                if kind == COREWEBVIEW2_PERMISSION_KIND_CLIPBOARD_READ
                    || kind == COREWEBVIEW2_PERMISSION_KIND_LOCAL_FONTS
                {
                    args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
                } else {
                    args.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY)?;
                }
                Ok(())
            })),
            &mut token,
        );
    });
}

/// 内嵌 axum 服务器端口
const AXUM_PORT: u16 = 3002;
const AXUM_FALLBACK_PORT_START: u16 = 3003;
const AXUM_FALLBACK_PORT_END: u16 = 3012;

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
        physical.width,
        physical.height
    );

    tauri::LogicalSize::new(init_w, init_h)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "windows")]
    suppress_windows_error_dialogs();

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
            commands::exit_app,
            commands::get_agent_status,
            commands::bridge_health,
            commands::bridge_get_settings,
            commands::bridge_save_settings,
            commands::bridge_reset_settings,
            commands::bridge_list_folders,
            commands::bridge_create_folder,
            commands::bridge_update_folder,
            commands::bridge_delete_folder,
            commands::bridge_list_shortcuts,
            commands::bridge_create_shortcut,
            commands::bridge_update_shortcut,
            commands::bridge_delete_shortcut,
            commands::bridge_list_shortcut_groups,
            commands::bridge_create_shortcut_group,
            commands::bridge_update_shortcut_group,
            commands::bridge_delete_shortcut_group,
            commands::bridge_list_connections,
            commands::bridge_get_connection,
            commands::bridge_get_connection_credential,
            commands::bridge_create_connection,
            commands::bridge_update_connection,
            commands::bridge_delete_connection,
            commands::bridge_batch_update_connections,
            commands::bridge_ping_connections,
            commands::bridge_terminal_open,
            commands::bridge_terminal_send,
            commands::bridge_terminal_close,
            commands::bridge_sftp_open,
            commands::bridge_sftp_send,
            commands::bridge_sftp_close,
        ])
        // 启动时：动态窗口尺寸 + 窗口效果 + 数据层 + axum 服务器
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "windows")]
            harden_windows_webview(&window);

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

            // ── 内嵌 axum 服务器 ──
            let db = match tauri::async_runtime::block_on(db::init(app.handle())) {
                Ok(db) => db,
                Err(e) => {
                    tracing::error!("[Vortix] 数据库初始化失败: {e}");
                    // 即使 db 初始化失败也显示窗口，避免窗口消失
                    let _ = window.show();
                    return Err(e.into());
                }
            };
            app.manage(db);
            app.manage(terminal_bridge::TerminalBridgeHub::new());
            app.manage(sftp_bridge::SftpBridgeHub::new());

            // ── 独立 agent 进程管理（当前阶段：可选启动，不阻断主流程） ──
            let agent_base_dir = app
                .path()
                .resource_dir()
                .ok()
                .or_else(|| std::env::current_exe().ok().and_then(|p| p.parent().map(|dir| dir.to_path_buf())))
                .unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
            let agent_state = agent::AgentState::new(agent_base_dir);
            app.manage(agent_state);
            app.state::<agent::AgentState>().inner().try_start();

            let (listener, port) = match tauri::async_runtime::block_on(
                server::bind_preferred_or_next(AXUM_PORT, AXUM_FALLBACK_PORT_START..=AXUM_FALLBACK_PORT_END),
            ) {
                Ok(bound) => bound,
                Err(e) => {
                    tracing::error!("[Vortix] 后端服务端口绑定失败: {e}");
                    return Err(e.into());
                }
            };
            let db = app.state::<db::Db>().inner().clone();
            tauri::async_runtime::spawn(async move {
                server::start(listener, port, db).await;
            });

            tracing::info!("[Vortix] Tauri 应用启动完成");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}
