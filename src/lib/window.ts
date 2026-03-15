/* ── Tauri v2 窗口控制 ── */
/*
 * 修复记录 2026-03-14:
 * - 移除 createWindow 的 Promise + tauri://created 事件等待（消除竞态死锁）
 * - 设置窗口单例改用 getByLabel() 替代内存变量（消除 HMR 残留）
 * - 移除互斥锁（不再需要）
 * - 所有路径加强日志输出
 */

import { getCurrentWindow } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { WindowOptions } from '@tauri-apps/api/window'
import type { WebviewOptions } from '@tauri-apps/api/webviewWindow'
import type { MouseEvent as ReactMouseEvent } from 'react'

let pinned = false

// Tauri 环境下从窗口实际状态初始化 pinned（HMR / 窗口重载后恢复）
if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
  getCurrentWindow().isAlwaysOnTop().then(v => { pinned = v }).catch(() => {})
}

// 窗口聚焦追踪：区分"聚焦点击"和"拖拽意图"
let justFocused = false
let focusTimer: ReturnType<typeof setTimeout> | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    justFocused = true
    if (focusTimer) clearTimeout(focusTimer)
    focusTimer = setTimeout(() => { justFocused = false }, 200)
  })
  window.addEventListener('blur', () => {
    justFocused = false
    if (focusTimer) { clearTimeout(focusTimer); focusTimer = null }
  })
}

/** 检测是否在 Tauri 环境中运行 */
function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}

/** 窗口选项类型 */
type CreateWindowOptions = Partial<WindowOptions> & Partial<WebviewOptions>

/**
 * 统一窗口创建：直接构造 WebviewWindow，不再等待 tauri://created 事件。
 *
 * 旧实现通过 Promise 包装 + once('tauri://created') 等待窗口就绪，
 * 但存在事件竞态：事件可能在监听器注册前已触发，导致 Promise 永不 resolve，
 * 进而触发 8 秒超时，配合互斥锁造成连锁死锁。
 *
 * 新实现：WebviewWindow 构造函数本身是同步返回实例的，
 * 事件监听仅用于日志记录，不阻塞调用方。
 */
function createWindow(label: string, options: CreateWindowOptions): WebviewWindow | null {
  if (!isTauri()) {
    console.warn('[Vortix] 非 Tauri 环境，无法创建窗口:', label)
    return null
  }

  console.info(`[Vortix] 创建窗口 [${label}]`, options.url)

  try {
    const win = new WebviewWindow(label, {
      visible: false,  // 先隐藏，等前端就绪后再 show()
      ...options,
    })

    // 事件监听仅用于日志，不阻塞
    win.once('tauri://created', () => {
      console.info(`[Vortix] 窗口就绪 [${label}]`)
    })
    win.once('tauri://error', (e) => {
      console.error(`[Vortix] 窗口创建错误 [${label}]:`, e.payload)
    })

    return win
  } catch (e) {
    console.error(`[Vortix] 窗口创建异常 [${label}]:`, e)
    return null
  }
}

/** 交互元素选择器，拖拽时需要排除 */
const INTERACTIVE_SELECTOR = [
  'button', 'a', 'input', 'select', 'textarea',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="menu"]',
  '[role="dialog"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="switch"]',
  '[role="tab"]',
  '[data-no-drag]',
  '[data-radix-collection-item]',
].join(', ')

/* ── 标题栏拖拽（替代 data-tauri-drag-region） ── */

/** mousedown 处理：仅在空白区域触发窗口拖动 */
export function handleTitleBarMouseDown(e: ReactMouseEvent): void {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest(INTERACTIVE_SELECTOR)) return
  if (!isTauri()) return
  // 窗口刚获得焦点时（200ms 内），跳过拖拽，避免聚焦点击误触发拖动
  if (justFocused) return
  getCurrentWindow().startDragging()
}

/** 双击标题栏切换最大化 */
export function handleTitleBarDoubleClick(e: ReactMouseEvent): void {
  const target = e.target as HTMLElement
  if (target.closest(INTERACTIVE_SELECTOR)) return
  if (!isTauri()) return
  getCurrentWindow().toggleMaximize()
}
/* ── 基础窗口控制 ── */

export function minimizeWindow(): void {
  if (!isTauri()) return
  getCurrentWindow().minimize()
}

export function maximizeWindow(): void {
  if (!isTauri()) return
  getCurrentWindow().toggleMaximize()
}

export function closeWindow(): void {
  if (!isTauri()) return
  getCurrentWindow().close()
}

export async function togglePinWindow(): Promise<boolean> {
  pinned = !pinned
  if (isTauri()) await getCurrentWindow().setAlwaysOnTop(pinned)
  return pinned
}

export function isPinned(): boolean {
  return pinned
}

/* ── 新窗口 ── */

export function openNewWindow(): void {
  createWindow(`clone-${Date.now()}`, {
    url: '/',
    title: 'Vortix',
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    decorations: false,
    center: true,
  })
}

/* ── 克隆窗口（携带标签状态） ── */

export function cloneCurrentWindow(serializedState: string): void {
  createWindow(`clone-${Date.now()}`, {
    url: `/?restore=${encodeURIComponent(serializedState)}`,
    title: 'Vortix',
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    decorations: false,
    center: true,
  })
}

/* ── 设置窗口（单例，基于 getByLabel 检测） ── */

export async function openSettingsWindow(nav?: string): Promise<void> {
  if (!isTauri()) {
    console.warn('[Vortix] 非 Tauri 环境，无法打开设置窗口')
    return
  }

  const label = 'settings'

  // 优先检测已存在的窗口（getByLabel 不依赖内存变量，HMR 安全）
  const existing = await WebviewWindow.getByLabel(label)
  if (existing) {
    console.info('[Vortix] 设置窗口已存在，聚焦')
    try {
      await existing.show()
      await existing.setFocus()
      if (nav) await existing.emit('navigate-settings', nav)
    } catch (e) {
      console.error('[Vortix] 聚焦设置窗口失败:', e)
      // 窗口可能已损坏，尝试关闭后重建
      try { await existing.close() } catch { /* 忽略 */ }
      // 短暂延迟后重建
      setTimeout(() => openSettingsWindow(nav), 200)
    }
    return
  }

  // 创建新设置窗口
  const url = nav ? `settings.html?nav=${nav}` : 'settings.html'
  const win = createWindow(label, {
    url,
    title: '设置 - Vortix',
    width: 900,
    height: 650,
    minWidth: 800,
    minHeight: 600,
    decorations: false,
    center: true,
  })

  if (win && nav) {
    // 等窗口就绪后发送导航事件
    win.once('tauri://created', () => {
      win.emit('navigate-settings', nav)
    })
  }
}

/* ── 新窗口打开指定连接 ── */

export function openConnectionInNewWindow(connectionId: string): void {
  createWindow(`connection-${Date.now()}`, {
    url: `/?connect=${connectionId}`,
    title: 'Vortix',
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    decorations: false,
    center: true,
  })
}

/* ── 终端分离为独立窗口 ── */

export function detachTerminal(tabId: string, connectionId: string): void {
  createWindow(`terminal-${Date.now()}`, {
    url: `/?detach=terminal&id=${connectionId}&tab=${tabId}`,
    title: 'Vortix Terminal',
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    decorations: false,
    center: true,
  })
}
