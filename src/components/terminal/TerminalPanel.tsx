import { useState, useCallback } from 'react'
import { Plus, X, Terminal as TerminalIcon, Circle } from 'lucide-react'
import SshTerminal from './SshTerminal'
import SshConnectDialog from './SshConnectDialog'

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
    connecting: 'text-[#E6A23C]',
    connected: 'text-[#00B42A]',
    closed: 'text-[#86909C]',
    error: 'text-[#F53F3F]',
  }

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0">
      {/* 标签栏 */}
      <div className="h-10 flex items-end px-2 border-b border-[#E5E6EB] bg-[#F7F8FA] shrink-0 gap-0.5 pt-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`flex items-center gap-1.5 px-3 h-full rounded-t-md text-[13px] cursor-pointer transition-colors group ${
              tab.id === activeTabId
                ? 'bg-white border border-[#E5E6EB] border-b-0 text-[#1F2329] font-medium'
                : 'text-[#86909C] hover:text-[#4E5969] hover:bg-[#F2F3F5]'
            }`}
          >
            <Circle className={`w-2 h-2 fill-current ${statusColor[tab.status]}`} />
            <TerminalIcon className="w-3.5 h-3.5 text-[#86909C]" />
            <span className="max-w-[140px] truncate">{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              className="ml-1 text-[#86909C] hover:text-[#1F2329] opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* 新建标签按钮 */}
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center justify-center w-8 h-full text-[#86909C] hover:text-[#1F2329] hover:bg-[#F2F3F5] rounded-t-md transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 终端内容区 */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab ? (
          <SshTerminal
            key={activeTab.id}
            connection={activeTab.connection}
            onStatusChange={(status) => updateTabStatus(activeTab.id, status)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#86909C] gap-4">
            <TerminalIcon className="w-16 h-16 opacity-20" />
            <p className="text-[14px]">暂无终端会话</p>
            <button
              onClick={() => setDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] text-white bg-[#4080FF] hover:bg-[#3070EE] transition-colors"
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
