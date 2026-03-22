/* ── SSH 终端桥接组件 ── */
/* 根据 AppTab 判断数据来源，获取凭据后传递给 SshTerminal */

import { useState, useEffect, useCallback } from 'react'
import SshTerminal from './SshTerminal'
import { useUIStore } from '../../stores/useUIStore'
import { useTabStore } from '../../stores/useTabStore'
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
  passphrase?: string
  terminalEnhance?: boolean
  jump?: {
    connectionId?: string
    connectionName?: string
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
    passphrase?: string
  }
}

export default function SshTerminalWrapper({ tab }: Props) {
  const updateTabStatus = useTabStore((s) => s.updateTabStatus)
  const showContextMenu = useUIStore((s) => s.showContextMenu)
  const [connection, setConnection] = useState<ConnectionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const loadCredential = useCallback(async () => {
    setError(null)
    setConnection(null)
    try {
      if (tab.quickConnect) {
        setConnection({
          host: tab.quickConnect.host,
          port: tab.quickConnect.port,
          username: tab.quickConnect.username,
          password: tab.quickConnect.password,
          privateKey: tab.quickConnect.privateKey,
          passphrase: tab.quickConnect.passphrase,
          jump: tab.quickConnect.jump,
        })
      } else if (tab.connectionId) {
        const conn = await api.getConnection(tab.connectionId)
        const cred = await api.getConnectionCredential(tab.connectionId)
        setConnection({
          host: cred.host,
          port: cred.port,
          username: cred.username,
          password: cred.password,
          privateKey: cred.private_key,
          passphrase: cred.passphrase,
          terminalEnhance: Boolean((conn.advanced as Record<string, unknown> | undefined)?.terminalEnhance),
          jump: cred.jump ? {
            connectionId: cred.jump.connectionId,
            connectionName: cred.jump.connectionName,
            host: cred.jump.host,
            port: cred.jump.port,
            username: cred.jump.username,
            password: cred.jump.password,
            privateKey: cred.jump.private_key,
            passphrase: cred.jump.passphrase,
          } : undefined,
        })
      } else if (tab.assetRow) {
        setConnection({
          host: tab.assetRow.host,
          port: 22,
          username: tab.assetRow.user,
        })
      }
    } catch (e) {
      setError((e as Error).message)
      updateTabStatus(tab.id, 'error')
    }
  }, [tab.id, tab.quickConnect, tab.connectionId, tab.assetRow, updateTabStatus])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCredential()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCredential, retryKey])

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
          <div className="text-[12px] text-status-error mb-4">{error}</div>
          <button
            className="px-4 py-1.5 text-[12px] bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            onClick={() => setRetryKey(k => k + 1)}
          >
            点击重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <SshTerminal
      paneId={`wrapper-${tab.id}`}
      tabId={tab.id}
      connection={connection}
      connectionId={tab.connectionId}
      connectionName={tab.label}
      onStatusChange={handleStatusChange}
      onContextMenu={handleContextMenu}
    />
  )
}
