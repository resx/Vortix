/* ── 终端会话注册表 ── */
/* 模块级 Map，不依赖 React 生命周期，跨组件挂载/卸载持久存在 */

import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { SearchAddon } from '@xterm/addon-search'

export interface TerminalSession {
  /** xterm 渲染的 DOM 容器（保留滚动历史） */
  containerEl: HTMLDivElement
  term: Terminal
  fitAddon: FitAddon
  searchAddon: SearchAddon
  ws: WebSocket | null
  reconnectTimer: ReturnType<typeof setTimeout> | null
  reconnectCount: number
  isManualDisconnect: boolean
}

const sessions = new Map<string, TerminalSession>()

/** 正在跨标签页转移的 pane，跳过销毁 */
const transferring = new Set<string>()

export function getSession(paneId: string): TerminalSession | undefined {
  return sessions.get(paneId)
}

export function setSession(paneId: string, session: TerminalSession): void {
  sessions.set(paneId, session)
}

export function hasSession(paneId: string): boolean {
  return sessions.has(paneId)
}

export function markTransferring(paneId: string): void {
  transferring.add(paneId)
}

export function unmarkTransferring(paneId: string): void {
  transferring.delete(paneId)
}

export function isTransferring(paneId: string): boolean {
  return transferring.has(paneId)
}

/** 关闭 WS + dispose Terminal + 从 Map 删除 */
export function destroySession(paneId: string): void {
  const session = sessions.get(paneId)
  if (!session) return

  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer)
    session.reconnectTimer = null
  }
  session.isManualDisconnect = true
  session.ws?.close()
  session.ws = null
  session.term.dispose()

  // 移除 DOM 容器
  session.containerEl.remove()

  sessions.delete(paneId)
}
