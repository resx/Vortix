/* ── 统一注册入口 ── */
/* 在 App 初始化时调用，注册所有插槽模块 */

import { registerShortcutMenu } from './features/context-menu/menus/shortcut.menu'
import { registerSidebarAssetMenu } from './features/context-menu/menus/sidebar-asset.menu'
import { registerTableMenu } from './features/context-menu/menus/table.menu'
import { registerTabMenu } from './features/context-menu/menus/tab.menu'
import { registerTerminalMenu } from './features/context-menu/menus/terminal.menu'
import { registerSettingsModules } from './features/settings/register'
import { registerDialogs } from './features/dialogs/register'

let initialized = false

export function bootstrap() {
  if (initialized) return
  initialized = true

  // 右键菜单注册
  registerShortcutMenu()
  registerSidebarAssetMenu()
  registerTableMenu()
  registerTabMenu()
  registerTerminalMenu()

  // 设置面板注册
  registerSettingsModules()

  // 对话框注册
  registerDialogs()
}
