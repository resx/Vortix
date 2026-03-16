import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { restoreWindowState, setupWindowStateListener } from './lib/window-state'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/noto-sans-sc'
import './assets/fonts/ioskeley-mono/ioskeley-mono.css'
import './index.css'
import App from './App'

// 主程序入口
async function main() {
  const rootElement = document.getElementById('root')!
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  )

  // 尝试恢复上次窗口状态（位置+尺寸），首次启动由 Rust 端处理初始尺寸
  await restoreWindowState()

  // 启动窗口状态监听，用于下次启动恢复
  setupWindowStateListener()
}

// 等待 DOM 加载完毕后执行
document.addEventListener('DOMContentLoaded', () => {
  void main()
})
