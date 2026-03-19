// src/lib/window-state.ts

import { getCurrentWindow, PhysicalSize, PhysicalPosition } from '@tauri-apps/api/window'
import { LazyStore } from '@tauri-apps/plugin-store'

const store = new LazyStore('.window-state.dat')

interface WindowState {
  width: number
  height: number
  x: number
  y: number
}

/**
 * 保存窗口状态（大小和位置）
 */
export async function saveWindowState() {
  const window = getCurrentWindow()
  const size = await window.innerSize()
  const position = await window.innerPosition()
  const state: WindowState = {
    width: size.width,
    height: size.height,
    x: position.x,
    y: position.y,
  }
  await store.set('window-state', state)
  await store.save()
}

/**
 * 恢复窗口状态。如果成功恢复，返回 true；否则返回 false。
 */
export async function restoreWindowState(): Promise<boolean> {
  try {
    const state = await store.get<WindowState>('window-state')
    if (!state) return false

    const window = getCurrentWindow()

    // 安全校验：确保坐标在合理范围内，避免窗口飞到屏幕外
    const monitor = await window.currentMonitor()
    if (monitor) {
      const { width: mw, height: mh } = monitor.size
      const safeX = Math.max(-100, Math.min(state.x, mw - 100))
      const safeY = Math.max(0, Math.min(state.y, mh - 100))
      const safeW = Math.max(800, Math.min(state.width, mw))
      const safeH = Math.max(600, Math.min(state.height, mh))
      await window.setSize(new PhysicalSize(safeW, safeH))
      await window.setPosition(new PhysicalPosition(safeX, safeY))
    } else {
      // 无法获取显示器信息，仅恢复尺寸，不恢复位置
      await window.setSize(new PhysicalSize(state.width, state.height))
      await window.center()
    }
    return true
  } catch (e) {
    console.warn('[Vortix] 恢复窗口状态失败:', e)
    return false
  }
}

/**
 * 监听窗口变化并自动保存
 */
export function setupWindowStateListener() {
  let timer: number | undefined

  const onStateChange = () => {
    if (timer) clearTimeout(timer)
    timer = globalThis.setTimeout(saveWindowState, 500) // 防抖
  }

  const tauriWindow = getCurrentWindow()
  tauriWindow.onResized(onStateChange)
  tauriWindow.onMoved(onStateChange)

  // 初始加载后保存一次
  globalThis.addEventListener('load', () => {
    setTimeout(saveWindowState, 1000)
  })
}
