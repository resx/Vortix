/* ── 设置窗口轻量入口 ── */
/* 独立于主 SPA，仅加载设置相关模块，大幅减少冷启动时间 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/noto-sans-sc'
import './assets/fonts/ioskeley-mono/ioskeley-mono.css'
import './index.css'

// 仅注册设置面板（跳过终端、SFTP、资产、右键菜单等）
import { registerSettingsModules } from './features/settings/register'
registerSettingsModules()

import SettingsWindow from './components/windows/SettingsWindow'

document.getElementById('app-loader')?.remove()
document.documentElement.classList.add('settings-window')
document.body.classList.add('settings-window-body')
const root = document.getElementById('root')!
root.classList.add('settings-window-root')

createRoot(root).render(
  <StrictMode>
    <SettingsWindow />
  </StrictMode>,
)
