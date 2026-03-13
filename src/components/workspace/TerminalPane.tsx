/* ── 终端面板（叶子节点） ── */
/* 包含：PaneToolbar（浮动工具栏，仅多 pane 时显示）、DropOverlay、SshTerminal */

import { useState, useCallback, useRef, useEffect } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import SshTerminal from '../terminal/SshTerminal'
import type { TerminalConnection } from '../terminal/SshTerminal'
import { useWorkspaceStore, collectLeafIds, findNode } from '../../stores/useWorkspaceStore'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { destroySession, isTransferring, markTransferring, unmarkTransferring } from '../../stores/terminalSessionRegistry'
import * as api from '../../api/client'
import type { AppTab } from '../../types'
import type { DropZone } from '../../types/workspace'

interface Props {
  paneId: string
  tabId: string
  tab: AppTab
  collapsed: boolean
  isActive: boolean
  paneIndex?: number
}

/* ── DropOverlay：四象限拖拽预览 ── */
function DropOverlay({ zone }: { zone: DropZone | null }) {
  if (!zone || zone === 'center') return null
  const posMap: Record<string, string> = {
    left: 'left-0 top-0 w-1/2 h-full',
    right: 'right-0 top-0 w-1/2 h-full',
    top: 'left-0 top-0 w-full h-1/2',
    bottom: 'left-0 bottom-0 w-full h-1/2',
  }
  return (
    <div className={`absolute ${posMap[zone]} bg-primary/20 backdrop-blur-[2px] border-2 border-primary/40 rounded-md z-20 pointer-events-none transition-all duration-150`} />
  )
}

/* ── PaneToolbar：浮动在右上角的操作栏 ── */
function PaneToolbar({
  paneId, tabId, tab, collapsed, onDragStart, paneIndex, paneLabel,
}: {
  paneId: string; tabId: string; tab: AppTab; collapsed: boolean
  onDragStart: (e: React.DragEvent) => void
  paneIndex?: number
  paneLabel?: string
}) {
  const toggleCollapsed = useWorkspaceStore(s => s.toggleCollapsed)
  const closePane = useWorkspaceStore(s => s.closePane)
  const setActivePane = useWorkspaceStore(s => s.setActivePane)

  // 折叠态：右上角紧贴按钮，半透明可透视底部文字
  if (collapsed) {
    return (
      <button
        className="absolute top-0 right-0 z-10 w-[26px] h-[26px] flex items-center justify-center rounded-bl-md bg-black/20 backdrop-blur-[2px] text-white/60 hover:bg-black/40 hover:text-white/90 transition-all"
        onClick={(e) => { e.stopPropagation(); toggleCollapsed(tabId, paneId) }}
      >
        <AppIcon icon={icons.chevronLeft} size={14} />
      </button>
    )
  }

  // 展开态：浮动工具条
  return (
    <div
      className="absolute top-0 right-0 z-10 flex items-center h-[24px] rounded-bl-md bg-black/25 backdrop-blur-[2px] text-white/90 px-1.5 gap-1 select-none hover:bg-black/45 transition-all"
      draggable
      onDragStart={onDragStart}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => setActivePane(tabId, paneId)}
    >
      <AppIcon icon={icons.gripVertical} size={12} className="text-white/60 cursor-grab shrink-0" />
      {paneIndex != null && (
        <span className="text-[10px] text-white/50 font-mono">#{paneIndex}</span>
      )}
      <span className="text-[11px] text-white/80 truncate max-w-[120px]">
        {paneLabel || tab.label || tab.assetRow?.host || 'Terminal'}
      </span>
      <button
        className="p-0.5 rounded hover:bg-white/15 text-white/70 hover:text-white"
        onClick={(e) => { e.stopPropagation(); toggleCollapsed(tabId, paneId) }}
      >
        <AppIcon icon={icons.chevronRight} size={12} />
      </button>
      <button
        className="p-0.5 rounded hover:bg-red-500/30 text-white/70 hover:text-red-300 shrink-0"
        onClick={(e) => { e.stopPropagation(); closePane(tabId, paneId) }}
      >
        <AppIcon icon={icons.close} size={12} />
      </button>
    </div>
  )
}

export default function TerminalPane({ paneId, tabId, tab, collapsed, isActive, paneIndex }: Props) {
  const showContextMenu = useUIStore(s => s.showContextMenu)
  const updateTabStatus = useTabStore(s => s.updateTabStatus)
  const setActivePane = useWorkspaceStore(s => s.setActivePane)
  const workspace = useWorkspaceStore(s => s.workspaces[tabId])
  const movePane = useWorkspaceStore(s => s.movePane)
  const paneMeta = useWorkspaceStore(s => s.getPaneMeta(tabId, paneId))

  const closeTab = useTabStore(s => s.closeTab)

  const [dropZone, setDropZone] = useState<DropZone | null>(null)
  const [connection, setConnection] = useState<TerminalConnection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)

  // 加载凭据（每个 pane 独立加载一次）
  // 优先从 paneMeta 加载（同屏打开 / 跨标签页转移），否则从 tab 级别加载
  const loadCredential = useCallback(async () => {
    if (loadedRef.current) return
    loadedRef.current = true
    try {
      // 确定连接来源：paneMeta 优先于 tab
      const connId = paneMeta?.connectionId ?? tab.connectionId
      const quickConn = paneMeta?.quickConnect ?? tab.quickConnect
      const assetRow = paneMeta?.assetRow ?? tab.assetRow

      if (quickConn) {
        setConnection(quickConn)
      } else if (connId) {
        const conn = await api.getConnection(connId)
        if (conn.protocol === 'local') {
          const adv = conn.advanced as Record<string, unknown>
          setConnection({
            type: 'local',
            shell: (adv.shell as string) || 'powershell',
            workingDir: (adv.workingDir as string) || undefined,
            initialCommand: (adv.initialCommand as string) || undefined,
          })
        } else {
          const cred = await api.getConnectionCredential(connId)
          setConnection({ host: cred.host, port: cred.port, username: cred.username, password: cred.password, privateKey: cred.private_key, passphrase: cred.passphrase })
        }
      } else if (assetRow) {
        setConnection({ host: assetRow.host, port: 22, username: assetRow.user })
      }
    } catch (e) {
      setError((e as Error).message)
      updateTabStatus(tab.id, 'error')
    }
  }, [tab, paneMeta, updateTabStatus])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCredential()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCredential])

  // 智能卸载：pane 被关闭时销毁会话，树结构重组（分屏）或跨标签页转移时保留
  useEffect(() => {
    return () => {
      // 检查 pane 是否存在于任意工作区（处理跨标签页转移）
      const allWorkspaces = useWorkspaceStore.getState().workspaces
      const existsAnywhere = Object.values(allWorkspaces).some(ws =>
        ws && findNode(ws.rootNode, paneId)
      )
      if (!existsAnywhere && !isTransferring(paneId)) {
        destroySession(paneId)
      }
    }
  }, [tabId, paneId])

  const paneCount = workspace ? collectLeafIds(workspace.rootNode).length : 1

  const handleStatusChange = useCallback((status: 'connecting' | 'connected' | 'closed' | 'error') => {
    updateTabStatus(tab.id, status)
  }, [tab.id, updateTabStatus])

  const handleContextMenu = useCallback((x: number, y: number, hasSelection: boolean) => {
    showContextMenu(x, y, 'terminal', { tabId: tab.id, hasSelection, paneId })
  }, [tab.id, paneId, showContextMenu])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/pane-id', paneId)
    e.dataTransfer.setData('text/source-tab-id', tabId)
    e.dataTransfer.effectAllowed = 'move'
  }, [paneId, tabId])

  // 四象限计算
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    // 对角线法
    if (x < 0.25) setDropZone('left')
    else if (x > 0.75) setDropZone('right')
    else if (y < 0.25) setDropZone('top')
    else if (y > 0.75) setDropZone('bottom')
    else setDropZone('center')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!dropZone || dropZone === 'center') { setDropZone(null); return }

    // 情况 1：同标签页内 pane 拖拽
    const sourceId = e.dataTransfer.getData('text/pane-id')
    if (sourceId) {
      const sourceTabId = e.dataTransfer.getData('text/source-tab-id')
      if (sourceTabId && sourceTabId !== tabId) {
        // 跨标签页 pane 拖拽（从其他标签页拖入当前终端分屏）
        markTransferring(sourceId)
        const wsStore = useWorkspaceStore.getState()
        // 提取 pane 并获取其元数据
        const extractedMeta = wsStore.extractPane(sourceTabId, sourceId)
        if (extractedMeta) {
          // 如果 pane 自身没有 meta，从源标签页构建
          const sourceTab = useTabStore.getState().tabs.find(t => t.id === sourceTabId)
          const meta = extractedMeta.label ? extractedMeta : sourceTab ? {
            label: sourceTab.label,
            connectionId: sourceTab.connectionId,
            assetRow: sourceTab.assetRow,
            quickConnect: sourceTab.quickConnect,
            connectedAt: sourceTab.connectedAt,
          } : extractedMeta
          wsStore.insertPaneAt(tabId, paneId, sourceId, dropZone, meta)
          // 同步源标签页信息（若仅剩一个带 meta 的 pane）
          useTabStore.getState().syncTabWithRemainingPanes(sourceTabId)
        }
        setTimeout(() => unmarkTransferring(sourceId), 100)
      } else {
        movePane(tabId, sourceId, paneId, dropZone)
      }
      setDropZone(null)
      return
    }

    // 情况 2：标签页拖入分屏
    const dragTabId = e.dataTransfer.getData('text/tab-id')
    if (dragTabId && dragTabId !== tabId) {
      // 禁止拖动当前激活标签页到终端分屏
      const appStore = useTabStore.getState()
      if (dragTabId === appStore.activeTabId) { setDropZone(null); return }
      const sourceTab = appStore.tabs.find(t => t.id === dragTabId)
      const wsStore = useWorkspaceStore.getState()
      const sourceWs = wsStore.workspaces[dragTabId]
      if (sourceWs) {
        const leafIds = collectLeafIds(sourceWs.rootNode)
        if (leafIds.length > 0) {
          const sourcePaneId = leafIds[0]
          leafIds.forEach(markTransferring)
          // 从源标签页构建元数据
          const meta = sourceTab ? {
            label: sourceTab.label,
            connectionId: sourceTab.connectionId,
            assetRow: sourceTab.assetRow,
            quickConnect: sourceTab.quickConnect,
            connectedAt: sourceTab.connectedAt,
          } : undefined
          wsStore.insertPaneAt(tabId, paneId, sourcePaneId, dropZone, meta)
          closeTab(dragTabId)
          // 延迟解除转移标记，等 React 完成渲染
          setTimeout(() => leafIds.forEach(unmarkTransferring), 100)
        }
      }
    }

    setDropZone(null)
  }, [tabId, paneId, dropZone, movePane, closeTab])

  return (
    <div
      className={`flex flex-col min-w-0 min-h-0 relative border transition-colors
        ${isActive ? 'border-primary/30' : 'border-transparent'}`}
      style={{ flex: 1 }}
      onClick={() => setActivePane(tabId, paneId)}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropZone(null)}
      onDrop={handleDrop}
    >
      {/* 终端始终占满整个区域 */}
      <div className="flex-1 min-h-0">
        {error ? (
          <div className="flex-1 flex items-center justify-center text-text-3 h-full">
            <div className="text-center">
              <div className="text-[14px] mb-2">连接失败</div>
              <div className="text-[12px] text-status-error">{error}</div>
            </div>
          </div>
        ) : (
          <SshTerminal
            paneId={paneId}
            tabId={tabId}
            connection={connection}
            onStatusChange={handleStatusChange}
            onContextMenu={handleContextMenu}
          />
        )}
      </div>
      {/* 多 pane 时浮动工具栏 */}
      {paneCount > 1 && (
        <PaneToolbar
          paneId={paneId} tabId={tabId} tab={tab}
          collapsed={collapsed}
          onDragStart={handleDragStart}
          paneIndex={paneIndex}
          paneLabel={paneMeta?.label}
        />
      )}
      <DropOverlay zone={dropZone} />
    </div>
  )
}
