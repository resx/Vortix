/* ── SFTP 路径联动 hook ── */
/* 监听终端输入，检测 cd 命令并同步 SFTP 路径 */

import { useEffect, useRef } from 'react'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useWorkspaceStore } from '../../../stores/useWorkspaceStore'
import { addInputListener, removeInputListener } from '../../../stores/terminalSessionRegistry'

/**
 * 当 pathSyncEnabled 为 true 时，监听关联终端的输入，
 * 检测 cd 命令并自动导航 SFTP 到对应路径。
 */
export function usePathSync(
  targetTabId: string | null,
  onNavigate: (path: string) => void,
) {
  const pathSyncEnabled = useSftpStore(s => s.pathSyncEnabled)
  const bufferRef = useRef('')

  useEffect(() => {
    if (!pathSyncEnabled || !targetTabId) return

    const ws = useWorkspaceStore.getState().workspaces[targetTabId]
    const paneId = ws?.activePaneId
    if (!paneId) return

    const listener = (data: string) => {
      // 逐字符累积，遇到回车解析命令
      for (const ch of data) {
        if (ch === '\r' || ch === '\n') {
          const line = bufferRef.current.trim()
          bufferRef.current = ''
          if (!line) continue

          // 匹配 cd 命令（支持 cd /path、cd ~/path、cd ..、cd -）
          const match = line.match(/^cd\s+(.+)$/)
          if (!match) continue

          const target = match[1].trim().replace(/^["']|["']$/g, '')
          if (!target) continue

          const { currentPath } = useSftpStore.getState()

          let resolved: string
          if (target === '-') {
            // cd - 不好追踪，跳过
            continue
          } else if (target === '~' || target.startsWith('~/')) {
            const { homePath } = useSftpStore.getState()
            resolved = target === '~' ? homePath : `${homePath}/${target.slice(2)}`
          } else if (target.startsWith('/')) {
            resolved = target
          } else {
            // 相对路径
            resolved = currentPath === '/' ? `/${target}` : `${currentPath}/${target}`
          }

          // 简单处理 .. 和 .
          const parts = resolved.split('/').filter(Boolean)
          const stack: string[] = []
          for (const p of parts) {
            if (p === '..') stack.pop()
            else if (p !== '.') stack.push(p)
          }
          resolved = '/' + stack.join('/')

          // 延迟导航，等终端命令执行完
          setTimeout(() => onNavigate(resolved), 300)
        } else if (ch === '\x7f' || ch === '\b') {
          // 退格
          bufferRef.current = bufferRef.current.slice(0, -1)
        } else if (ch === '\x15') {
          // Ctrl+U 清行
          bufferRef.current = ''
        } else if (ch === '\x17') {
          // Ctrl+W 删词
          bufferRef.current = bufferRef.current.replace(/\S+\s*$/, '')
        } else if (ch >= ' ') {
          bufferRef.current += ch
        }
      }
    }

    addInputListener(paneId, listener)
    return () => {
      removeInputListener(paneId, listener)
      bufferRef.current = ''
    }
  }, [pathSyncEnabled, targetTabId, onNavigate])
}
