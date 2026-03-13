/* ── SFTP 路径联动 hook ── */
/* 双向联动：SSH cd → SFTP 跟随 | SFTP 导航 → SSH cd */

import { useEffect, useRef, useCallback } from 'react'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useWorkspaceStore } from '../../../stores/useWorkspaceStore'
import {
  addInputListener,
  removeInputListener,
  getSession,
} from '../../../stores/terminalSessionRegistry'

interface UsePathSyncParams {
  targetTabId: string | null
  onNavigate: (path: string) => void
}

/** 通过 SSH WebSocket 获取终端当前工作目录 */
function queryTerminalPwd(paneId: string): Promise<string | null> {
  const session = getSession(paneId)
  if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) {
    return Promise.resolve(null)
  }

  const requestId = `pwd-${Date.now()}`
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 3000)

    const handler = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string)
        if (msg.type === 'pwd-result' && msg.data?.requestId === requestId) {
          cleanup()
          resolve(msg.data.path || null)
        }
      } catch { /* ignore */ }
    }

    const cleanup = () => {
      clearTimeout(timeout)
      session.ws?.removeEventListener('message', handler)
    }

    session.ws!.addEventListener('message', handler)
    session.ws!.send(JSON.stringify({ type: 'pwd', data: { requestId } }))
  })
}

/**
 * 双向路径联动：
 * 1. SSH → SFTP：检测终端 Enter 键，通过 SSH pwd 获取真实路径后同步
 * 2. SFTP → SSH：SFTP 导航时向终端发送 cd 命令
 */
export function usePathSync({ targetTabId, onNavigate }: UsePathSyncParams) {
  const pathSyncEnabled = useSftpStore(s => s.pathSyncEnabled)
  const connected = useSftpStore(s => s.connected)
  const pendingPwdRef = useRef(false)
  const suppressRef = useRef(false)

  // SSH → SFTP：监听终端输入，检测 Enter 后通过 SSH pwd 获取真实路径
  useEffect(() => {
    if (!pathSyncEnabled || !targetTabId || !connected) return

    const ws = useWorkspaceStore.getState().workspaces[targetTabId]
    const paneId = ws?.activePaneId
    if (!paneId) return

    const listener = (data: string) => {
      for (const ch of data) {
        if ((ch === '\r' || ch === '\n') && !pendingPwdRef.current && !suppressRef.current) {
          pendingPwdRef.current = true

          setTimeout(async () => {
            try {
              const remoteCwd = await queryTerminalPwd(paneId)
              if (!remoteCwd || !remoteCwd.startsWith('/')) return

              const { currentPath } = useSftpStore.getState()
              if (remoteCwd !== currentPath) {
                onNavigate(remoteCwd)
              }
            } catch {
              // 静默忽略
            } finally {
              pendingPwdRef.current = false
            }
          }, 500)
        }
      }
    }

    addInputListener(paneId, listener)
    return () => {
      removeInputListener(paneId, listener)
      pendingPwdRef.current = false
    }
  }, [pathSyncEnabled, targetTabId, connected, onNavigate])

  // SFTP → SSH：SFTP 导航时向终端发送 cd 命令
  const syncToTerminal = useCallback((path: string) => {
    if (!pathSyncEnabled || !targetTabId) return

    const ws = useWorkspaceStore.getState().workspaces[targetTabId]
    const paneId = ws?.activePaneId
    if (!paneId) return

    const session = getSession(paneId)
    if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) return

    suppressRef.current = true
    // 先发 Ctrl+U 清空终端当前行的未完成输入，避免 cd 命令拼接到已有内容后面
    const escapedPath = path.replace(/'/g, "'\\''")
    session.ws.send(JSON.stringify({ type: 'input', data: `\x15cd '${escapedPath}'\r` }))

    setTimeout(() => { suppressRef.current = false }, 800)
  }, [pathSyncEnabled, targetTabId])

  return { syncToTerminal }
}
