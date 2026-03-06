import { useState, useCallback } from 'react'
import { Plus, X, Terminal as TerminalIcon, Circle } from 'lucide-react'
import SshTerminal from './SshTerminal'
import SshConnectDialog from './SshConnectDialog'
import { useAppStore } from '../../stores/useAppStore'

interface SshTab {
  id: string
  label: string
  connection: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
  }
  status: 'connecting' | 'connected' | 'closed' | 'error'
}

let tabCounter = 0

export default function TerminalPanel() {
  const [tabs, setTabs] = useState<SshTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const showContextMenu = useAppStore((s) => s.showContextMenu)

  const handleConnect = useCallback((config: SshTab['connection']) => {
    const id = `ssh-${++tabCounter}`
    const newTab: SshTab = {
      id,
      label: `${config.username}@${config.host}`,
      connection: config,
      status: 'connecting',
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(id)
    setDialogOpen(false)
  }, [])

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id)
      if (activeTabId === id) {
        setActiveTabId(next.length > 0 ? next[next.length - 1].id : null)
      }
      return next
    })
  }, [activeTabId])

  const updateTabStatus = useCallback((id: string, status: SshTab['status']) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
  }, [])

  const statusColor: Record<SshTab['status'], string> = {
    connecting: 'text-status-warning',
    connected: 'text-status-success',
    closed: 'text-text-3',
    error: 'text-status-error',
  }

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex-1 flex flex-col bg-bg-card min-w-0">
      {/* 标签栏 */}
      <div className="h-10 flex items-end px-2 border-b border-border bg-bg-subtle shrink-0 gap-0.5 pt-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`flex items-center gap-1.5 px-3 h-full rounded-t-md text-[13px] cursor-pointer transition-colors group ${
              tab.id === activeTabId
                ? 'bg-bg-card border border-border border-b-0 text-text-1 font-medium'
                : 'text-text-3 hover:text-text-2 hover:bg-bg-hover'
            }`}
          >
            <Circle className={`w-2 h-2 fill-current ${statusColor[tab.status]}`} />
            <TerminalIcon className="w-3.5 h-3.5 text-text-3" />
            <span className="max-w-[140px] truncate">{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              className="ml-1 text-text-3 hover:text-text-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* 新建标签按钮 */}
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center justify-center w-8 h-full text-text-3 hover:text-text-1 hover:bg-bg-hover rounded-t-md transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 终端内容区 */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab ? (
          <SshTerminal
            key={activeTab.id}
            paneId={`legacy-${activeTab.id}`}
            connection={activeTab.connection}
            onStatusChange={(status) => updateTabStatus(activeTab.id, status)}
            onContextMenu={(x, y, hasSelection) => {
              showContextMenu(x, y, 'terminal', { tabId: activeTab.id, paneId: '', hasSelection })
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-3 gap-4">
            <TerminalIcon className="w-16 h-16 opacity-20" />
            <p className="text-[14px]">暂无终端会话</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] text-white bg-primary hover:opacity-90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建 SSH 连接
            </button>
          </div>
        )}
      </div>

      {/* 连接对话框 */}
      <SshConnectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConnect={handleConnect}
      />
    </div>
  )
}
