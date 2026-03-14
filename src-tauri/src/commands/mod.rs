/* ── Tauri Commands ── */

use font_kit::source::SystemSource;

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
