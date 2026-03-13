import { create } from 'zustand'
import type { AppTab, ListViewMode, AssetRow } from '../types'
import { useWorkspaceStore, nextPaneId } from './useWorkspaceStore'
import { destroySession } from './terminalSessionRegistry'

interface TabState {
  tabs: AppTab[]
  activeTabId: string
  listViewMode: ListViewMode

  openAssetTab: (row: AssetRow) => void
  openQuickConnect: (config: { host: string; port: number; username: string; password?: string; privateKey?: string; passphrase?: string }) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setListViewMode: (mode: ListViewMode) => void
  reorderTab: (fromId: string, toId: string) => void
  updateTabStatus: (id: string, status: AppTab['status']) => void
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
  closeLeftTabs: (tabId: string) => void
  closeRightTabs: (tabId: string) => void
  renameTab: (tabId: string, newLabel: string) => void
  duplicateTab: (tabId: string) => void
  reconnectTab: (tabId: string) => void
  createTabFromPane: (sourceTabId: string, paneId: string) => string | null
  syncTabWithRemainingPanes: (tabId: string) => void
  openSplitTab: (rows: AssetRow[]) => void
  /** 删除连接时关闭对应标签页 */
  closeTabsByConnectionId: (connectionId: string) => void
  serializeTabState: () => string
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [{ id: 'list', type: 'list', label: '列表', status: 'idle' }],
  activeTabId: 'list',
  listViewMode: 'list',

  openAssetTab: (row) => set((s) => {
    const existing = s.tabs.find(t => t.type === 'asset' && t.assetRow?.id === row.id)
    if (existing) return { activeTabId: existing.id }
    const newTab: AppTab = {
      id: `asset-${row.id}`,
      type: 'asset',
      label: row.name,
      assetRow: row,
      status: 'connecting',
      connectionId: row.id,
    }
    return { tabs: [...s.tabs, newTab], activeTabId: newTab.id }
  }),

  openQuickConnect: (config) => set((s) => {
    const id = `quick-${Date.now()}`
    const newTab: AppTab = {
      id,
      type: 'asset',
      label: `${config.host}:${config.port}`,
      status: 'connecting',
      quickConnect: config,
    }
    return { tabs: [...s.tabs, newTab], activeTabId: id }
  }),

  closeTab: (id) => set((s) => {
    if (id === 'list') return {}
    useWorkspaceStore.getState().removeWorkspace(id)
    const newTabs = s.tabs.filter(t => t.id !== id)
    const newActiveId = s.activeTabId === id ? 'list' : s.activeTabId
    return { tabs: newTabs, activeTabId: newActiveId }
  }),

  setActiveTab: (id) => set({ activeTabId: id }),
  setListViewMode: (mode) => set({ listViewMode: mode }),

  reorderTab: (fromId, toId) => set((s) => {
    if (fromId === toId) return {}
    const tabs = [...s.tabs]
    const fromIdx = tabs.findIndex(t => t.id === fromId)
    const toIdx = tabs.findIndex(t => t.id === toId)
    if (fromIdx < 0 || toIdx < 0) return {}
    const [moved] = tabs.splice(fromIdx, 1)
    tabs.splice(toIdx, 0, moved)
    return { tabs }
  }),

  updateTabStatus: (id, status) => set((s) => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, status, connectedAt: status === 'connected' ? new Date().toISOString() : t.connectedAt } : t),
  })),

  closeOtherTabs: (tabId) => set((s) => {
    const closingTabs = s.tabs.filter(t => t.id !== 'list' && t.id !== tabId)
    closingTabs.forEach(t => useWorkspaceStore.getState().removeWorkspace(t.id))
    return {
      tabs: s.tabs.filter(t => t.id === 'list' || t.id === tabId),
      activeTabId: s.activeTabId === tabId || s.activeTabId === 'list' ? s.activeTabId : tabId,
    }
  }),

  closeAllTabs: () => set((s) => {
    s.tabs.filter(t => t.id !== 'list').forEach(t => useWorkspaceStore.getState().removeWorkspace(t.id))
    return { tabs: s.tabs.filter(t => t.id === 'list'), activeTabId: 'list' }
  }),

  closeLeftTabs: (tabId) => set((s) => {
    const idx = s.tabs.findIndex(t => t.id === tabId)
    if (idx <= 0) return {}
    const closing = s.tabs.slice(0, idx).filter(t => t.id !== 'list')
    closing.forEach(t => useWorkspaceStore.getState().removeWorkspace(t.id))
    const closingIds = new Set(closing.map(t => t.id))
    return {
      tabs: s.tabs.filter(t => !closingIds.has(t.id)),
      activeTabId: closingIds.has(s.activeTabId) ? tabId : s.activeTabId,
    }
  }),

  closeRightTabs: (tabId) => set((s) => {
    const idx = s.tabs.findIndex(t => t.id === tabId)
    if (idx < 0) return {}
    const closing = s.tabs.slice(idx + 1).filter(t => t.id !== 'list')
    closing.forEach(t => useWorkspaceStore.getState().removeWorkspace(t.id))
    const closingIds = new Set(closing.map(t => t.id))
    return {
      tabs: s.tabs.filter(t => !closingIds.has(t.id)),
      activeTabId: closingIds.has(s.activeTabId) ? tabId : s.activeTabId,
    }
  }),

  renameTab: (tabId, newLabel) => set((s) => ({
    tabs: s.tabs.map(t => t.id === tabId ? { ...t, label: newLabel } : t),
  })),

  duplicateTab: (tabId) => set((s) => {
    const source = s.tabs.find(t => t.id === tabId)
    if (!source || source.type !== 'asset') return {}
    const baseName = source.label.replace(/\s*\(\d+\)$/, '')
    const count = s.tabs.filter(t => t.label === baseName || t.label.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(\\d+\\)$`))).length
    const newId = `asset-dup-${Date.now()}`
    const newTab: AppTab = {
      ...source,
      id: newId,
      label: `${baseName} (${count})`,
      status: 'connecting',
      connectedAt: undefined,
    }
    return { tabs: [...s.tabs, newTab], activeTabId: newId }
  }),

  reconnectTab: (tabId) => {
    const state = get()
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab || tab.type !== 'asset') return
    const wsStore = useWorkspaceStore.getState()
    const paneIds = wsStore.getAllPaneIds(tabId)
    paneIds.forEach((pid: string) => destroySession(pid))
    wsStore.removeWorkspace(tabId)
    set((s) => ({
      tabs: s.tabs.map(t => t.id === tabId ? {
        ...t,
        status: 'connecting' as const,
        reconnectKey: (t.reconnectKey ?? 0) + 1,
        connectedAt: undefined,
        errorMessage: undefined,
      } : t),
    }))
  },

  createTabFromPane: (sourceTabId, paneId) => {
    const state = get()
    const sourceTab = state.tabs.find(t => t.id === sourceTabId)
    if (!sourceTab) return null
    const wsStore = useWorkspaceStore.getState()
    const paneMeta = wsStore.getPaneMeta(sourceTabId, paneId)
    const extracted = wsStore.extractPane(sourceTabId, paneId)
    if (!extracted) return null
    const newTabId = `asset-pane-${Date.now()}`
    const newTab: AppTab = {
      id: newTabId,
      type: 'asset',
      label: paneMeta?.label || sourceTab.label,
      assetRow: paneMeta?.assetRow || sourceTab.assetRow,
      status: sourceTab.status,
      quickConnect: paneMeta?.quickConnect || sourceTab.quickConnect,
      connectionId: paneMeta?.connectionId || sourceTab.connectionId,
      connectedAt: paneMeta?.connectedAt || sourceTab.connectedAt,
    }
    wsStore.initWorkspaceWithPaneId(newTabId, paneId)
    set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: newTabId }))
    get().syncTabWithRemainingPanes(sourceTabId)
    return newTabId
  },

  syncTabWithRemainingPanes: (tabId) => {
    const wsStore = useWorkspaceStore.getState()
    const ws = wsStore.workspaces[tabId]
    if (!ws) return
    const leafIds = wsStore.getAllPaneIds(tabId)
    if (leafIds.length !== 1) return
    const meta = wsStore.getPaneMeta(tabId, leafIds[0])
    if (!meta?.label) return
    set((s) => ({
      tabs: s.tabs.map(t => t.id === tabId ? {
        ...t,
        label: meta.label,
        connectionId: meta.connectionId ?? t.connectionId,
        assetRow: meta.assetRow ?? t.assetRow,
        quickConnect: meta.quickConnect ?? t.quickConnect,
        connectedAt: meta.connectedAt ?? t.connectedAt,
      } : t),
    }))
  },

  openSplitTab: (rows) => {
    if (rows.length === 0) return
    if (rows.length === 1) { get().openAssetTab(rows[0]); return }
    const tabId = `split-${Date.now()}`
    const newTab: AppTab = {
      id: tabId,
      type: 'asset',
      label: rows[0].name,
      status: 'connecting',
    }
    set((s) => ({ tabs: [...s.tabs, newTab], activeTabId: tabId }))
    const panes = rows.map(r => ({
      id: nextPaneId(),
      meta: { label: r.name, connectionId: r.id, assetRow: r },
    }))
    useWorkspaceStore.getState().initWorkspaceWithPanes(tabId, panes)
  },

  closeTabsByConnectionId: (connectionId) => set((s) => {
    const newTabs = s.tabs.filter(t => t.connectionId !== connectionId)
    const newActiveId = s.tabs.find(t => t.connectionId === connectionId && t.id === s.activeTabId) ? 'list' : s.activeTabId
    return { tabs: newTabs, activeTabId: newActiveId }
  }),

  serializeTabState: () => {
    const { tabs, activeTabId } = get()
    const serializable = tabs.map(t => {
      const safeQuickConnect = t.quickConnect
        ? { host: t.quickConnect.host, port: t.quickConnect.port, username: t.quickConnect.username }
        : undefined
      return {
        id: t.id, type: t.type, label: t.label,
        connectionId: t.connectionId,
        assetRow: t.assetRow,
        quickConnect: safeQuickConnect,
      }
    })
    return JSON.stringify({ tabs: serializable, activeTabId })
  },
}))