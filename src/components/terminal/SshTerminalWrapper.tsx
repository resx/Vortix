/* ── SSH 终端桥接组件 ── */
/* 根据 AppTab 判断数据来源，获取凭据后传递给 SshTerminal */

import { useState, useEffect, useCallback } from 'react'
import SshTerminal from './SshTerminal'
import { useAppStore } from '../../stores/useAppStore'
import * as api from '../../api/client'
import type { AppTab } from '../../types'

interface Props {
  tab: AppTab
}

interface ConnectionInfo {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
}

export default function SshTerminalWrapper({ tab }: Props) {
  const updateTabStatus = useAppStore((s) => s.updateTabStatus)
  const showContextMenu = useAppStore((s) => s.showContextMenu)
  const [connection, setConnection] = useState<ConnectionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCredential() {
      try {
        if (tab.quickConnect) {
          // 快速连接：直接使用 tab 中的凭据
          setConnection({
            host: tab.quickConnect.host,
            port: tab.quickConnect.port,
            username: tab.quickConnect.username,
            password: tab.quickConnect.password,
            privateKey: tab.quickConnect.privateKey,
          })
        } else if (tab.connectionId) {
          // 保存的连接：从 API 获取解密凭据
          const cred = await api.getConnectionCredential(tab.connectionId)
          if (cancelled) return
          setConnection({
            host: cred.host,
            port: cred.port,
            username: cred.username,
            password: cred.password,
            privateKey: cred.private_key,
          })
        } else if (tab.assetRow) {
          // 兼容旧的 assetRow 方式（后端不可用时的降级）
          setConnection({
            host: tab.assetRow.host,
            port: 22,
            username: tab.assetRow.user,
          })
        }
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message)
        updateTabStatus(tab.id, 'error')
      }
    }

    loadCredential()
    return () => { cancelled = true }
  }, [tab.id, tab.quickConnect, tab.connectionId, tab.assetRow, updateTabStatus])

  const handleStatusChange = useCallback((status: 'connecting' | 'connected' | 'closed' | 'error') => {
    updateTabStatus(tab.id, status)
  }, [tab.id, updateTabStatus])

  const handleContextMenu = useCallback((x: number, y: number, hasSelection: boolean) => {
    showContextMenu(x, y, 'terminal', { tabId: tab.id, paneId: '', hasSelection })
  }, [tab.id, showContextMenu])

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-3">
        <div className="text-center">
          <div className="text-[14px] mb-2">连接失败</div>
          <div className="text-[12px] text-status-error">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <SshTerminal
      paneId={`wrapper-${tab.id}`}
      connection={connection}
      onStatusChange={handleStatusChange}
      onContextMenu={handleContextMenu}
    />
  )
}
