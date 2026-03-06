import { create } from 'zustand'
import type { TreeItem, ActiveFilter, ContextMenuState, AppTab, ListViewMode, AssetRow } from '../types'
import * as api from '../api/client'
import type { Folder, Connection } from '../api/types'
import { useWorkspaceStore } from './useWorkspaceStore'

interface AppState {
  activeFilter: ActiveFilter
  setActiveFilter: (filter: ActiveFilter) => void

  isSidebarOpen: boolean
  toggleSidebar: () => void

  assets: TreeItem[]
  shortcuts: TreeItem[]
  tableData: AssetRow[]
  toggleFolder: (target: 'assets' | 'shortcuts', id: string) => void
  expandAllFolders: (target: 'assets' | 'shortcuts') => void
  collapseAllFolders: (target: 'assets' | 'shortcuts') => void

  selectedSidebarItemId: string | null
  setSelectedSidebarItemId: (id: string | null) => void

  // 数据加载
  isDataLoading: boolean
  dataError: string | null
  fetchAssets: () => Promise<void>

  // 右键菜单
  contextMenu: ContextMenuState
  showContextMenu: (x: number, y: number, type: ContextMenuState['type'], data?: ContextMenuState['data']) => void
  hideContextMenu: () => void

  // 资产列表功能
  currentFolder: string | null
  setCurrentFolder: (id: string | null) => void

  isAnonymized: boolean
  toggleAnonymized: () => void

  isAssetHidden: boolean
  setAssetHidden: (v: boolean) => void

  showPing: boolean
  pings: Record<string, string>
  togglePing: () => void
  refreshPing: () => void

  showDirModal: boolean
  dirName: string
  setShowDirModal: (v: boolean) => void
  setDirName: (v: string) => void

  newMenuOpen: boolean
  setNewMenuOpen: (v: boolean) => void
  activeNewSubmenu: string | null
  setActiveNewSubmenu: (v: string | null) => void

  // 标签页系统
  tabs: AppTab[]
  activeTabId: string
  listViewMode: ListViewMode
  openAssetTab: (row: AssetRow) => void
  openQuickConnect: (config: { host: string; port: number; username: string; password?: string; privateKey?: string }) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setListViewMode: (mode: ListViewMode) => void
  reorderTab: (fromId: string, toId: string) => void
  updateTabStatus: (id: string, status: AppTab['status']) => void
  /** 从分屏面板创建独立标签页（保留会话，不重新连接） */
  createTabFromPane: (sourceTabId: string, paneId: string) => string | null
  /** 提取 pane 后，同步源标签页信息（若仅剩一个带 meta 的 pane，更新标签页标题和连接信息） */
  syncTabWithRemainingPanes: (tabId: string) => void
  updateTabStatus: (id: string, status: AppTab['status']) => void

  // 连接 CRUD
  moveConnectionToFolder: (connectionId: string, folderId: string | null) => Promise<void>
  createConnectionAction: (data: api.CreateConnectionDto) => Promise<void>
  deleteConnectionAction: (id: string) => Promise<void>

  // 文件夹 CRUD
  createFolderAction: (name: string, parentId?: string | null) => Promise<void>
  deleteFolderAction: (id: string) => Promise<void>
  renameFolderAction: (id: string, name: string) => Promise<void>
  renameConnectionAction: (id: string, name: string) => Promise<void>

  // 主菜单
  menuVariant: 'default' | 'glass'
  setMenuVariant: (v: 'default' | 'glass') => void

  // 设置面板
  settingsOpen: boolean
  toggleSettings: () => void

  // SFTP 与服务器面板
  sftpOpen: boolean
  toggleSftp: () => void
  serverPanelOpen: boolean
  toggleServerPanel: () => void

  // SSH 配置编辑器
  sshConfigOpen: boolean
  sshConfigMode: 'create' | 'edit'
  sshConfigInitialId: string | null
  openSshConfig: (mode: 'create' | 'edit', id?: string) => void
  closeSshConfig: () => void
}

const toggleInTree = (items: TreeItem[], id: string): TreeItem[] =>
  items.map(item =>
    item.id === id ? { ...item, isOpen: !item.isOpen } : item
  )

/** 将 API 数据合成前端 TreeItem[] */
function buildTree(folders: Folder[], connections: Connection[]): TreeItem[] {
  const tree: TreeItem[] = folders.map(f => ({
    id: f.id,
    name: f.name,
    type: 'folder' as const,
    isOpen: false,
    children: connections
      .filter(c => c.folder_id === f.id)
      .map(c => ({
        id: c.id,
        name: c.name,
        type: 'connection' as const,
        protocol: c.protocol,
      })),
  }))

  // 没有文件夹的连接放在顶层
  const orphanConnections = connections
    .filter(c => !c.folder_id)
    .map(c => ({
      id: c.id,
      name: c.name,
      type: 'connection' as const,
      protocol: c.protocol,
    }))

  return [...tree, ...orphanConnections]
}

/** 将 API 数据合成前端 AssetRow[] */
function buildTableData(folders: Folder[], connections: Connection[]): AssetRow[] {
  const folderMap = new Map(folders.map(f => [f.id, f.name]))

  const folderRows: AssetRow[] = folders.map(f => ({
    id: f.id,
    name: f.name,
    type: 'folder',
    latency: '-',
    host: '-',
    user: '-',
    created: f.created_at.replace('T', ' ').slice(0, 16),
    expire: '-',
    remark: '-',
  }))

  const connectionRows: AssetRow[] = connections.map(c => ({
    id: c.id,
    name: c.name,
    type: 'asset',
    protocol: c.protocol,
    latency: '-',
    host: c.host,
    user: c.username,
    created: c.created_at.replace('T', ' ').slice(0, 16),
    expire: '-',
    remark: c.remark || '-',
    folderId: c.folder_id,
    folderName: c.folder_id ? folderMap.get(c.folder_id) : undefined,
  }))

  return [...folderRows, ...connectionRows]
}

export const useAppStore = create<AppState>((set, get) => ({
  activeFilter: 'all',
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  assets: [],
  shortcuts: [],
  tableData: [],
  toggleFolder: (target, id) =>
    set((state) => ({
      [target]: toggleInTree(state[target], id),
    })),

  expandAllFolders: (target) =>
    set((state) => ({
      [target]: state[target].map(item =>
        item.type === 'folder' ? { ...item, isOpen: true } : item
      ),
    })),

  collapseAllFolders: (target) =>
    set((state) => ({
      [target]: state[target].map(item =>
        item.type === 'folder' ? { ...item, isOpen: false } : item
      ),
    })),

  selectedSidebarItemId: null,
  setSelectedSidebarItemId: (id) => set({ selectedSidebarItemId: id }),

  // 数据加载
  isDataLoading: false,
  dataError: null,

  fetchAssets: async () => {
    set({ isDataLoading: true, dataError: null })
    try {
      const [folders, connections] = await Promise.all([
        api.getFolders(),
        api.getConnections(),
      ])
      set({
        assets: buildTree(folders, connections),
        tableData: buildTableData(folders, connections),
        isDataLoading: false,
      })
    } catch (e) {
      set({ isDataLoading: false, dataError: (e as Error).message })
    }
  },

  contextMenu: { visible: false, x: 0, y: 0, type: null, data: null },
  showContextMenu: (x, y, type, data = null) => {
    set({ contextMenu: { visible: true, x, y, type, data } })
  },
  hideContextMenu: () =>
    set((s) => ({ contextMenu: { ...s.contextMenu, visible: false } })),

  currentFolder: null,
  setCurrentFolder: (id) => set({ currentFolder: id }),

  isAnonymized: false,
  toggleAnonymized: () => set((s) => ({ isAnonymized: !s.isAnonymized })),

  isAssetHidden: false,
  setAssetHidden: (v) => set({ isAssetHidden: v }),

  showPing: false,
  pings: {},
  togglePing: () => set((s) => {
    if (!s.showPing) {
      const newPings: Record<string, string> = {}
      s.tableData.forEach(row => {
        if (row.type === 'asset') {
          newPings[row.id] = Math.floor(Math.random() * 80 + 10) + 'ms'
        }
      })
      return { showPing: true, pings: newPings }
    }
    return { showPing: false }
  }),
  refreshPing: () => set((s) => {
    const newPings: Record<string, string> = {}
    s.tableData.forEach(row => {
      if (row.type === 'asset') {
        newPings[row.id] = Math.floor(Math.random() * 80 + 10) + 'ms'
      }
    })
    return { pings: newPings }
  }),

  showDirModal: false,
  dirName: '',
  setShowDirModal: (v) => set({ showDirModal: v, dirName: '' }),
  setDirName: (v) => set({ dirName: v }),

  newMenuOpen: false,
  setNewMenuOpen: (v) => set({ newMenuOpen: v, activeNewSubmenu: null }),
  activeNewSubmenu: null,
  setActiveNewSubmenu: (v) => set({ activeNewSubmenu: v }),

  // 标签页系统
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
    // 联动清理分屏工作区
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

  createTabFromPane: (sourceTabId, paneId) => {
    const state = get()
    const sourceTab = state.tabs.find(t => t.id === sourceTabId)
    if (!sourceTab) return null

    // 先读取 pane 自身的元数据（跨标签页转移时保留的原始信息）
    const wsStore = useWorkspaceStore.getState()
    const paneMeta = wsStore.getPaneMeta(sourceTabId, paneId)

    // 从源工作区提取 pane
    const extracted = wsStore.extractPane(sourceTabId, paneId)
    if (!extracted) return null

    // 创建新标签页：优先使用 pane 自身 meta，回退到源标签页信息
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

    // 为新标签页创建工作区，复用原 paneId（保留会话）
    wsStore.initWorkspaceWithPaneId(newTabId, paneId)

    set((s) => ({
      tabs: [...s.tabs, newTab],
      activeTabId: newTabId,
    }))

    // 同步源标签页信息
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

  // 连接 CRUD
  moveConnectionToFolder: async (connectionId, folderId) => {
    await api.updateConnection(connectionId, { folder_id: folderId })
    await get().fetchAssets()
  },

  createConnectionAction: async (data) => {
    await api.createConnection(data)
    await get().fetchAssets()
  },

  deleteConnectionAction: async (id) => {
    await api.deleteConnection(id)
    // 关闭对应标签
    set((s) => {
      const newTabs = s.tabs.filter(t => t.connectionId !== id)
      const newActiveId = s.tabs.find(t => t.connectionId === id && t.id === s.activeTabId) ? 'list' : s.activeTabId
      return { tabs: newTabs, activeTabId: newActiveId }
    })
    await get().fetchAssets()
  },

  // 文件夹 CRUD
  createFolderAction: async (name, parentId) => {
    await api.createFolder({ name, parent_id: parentId ?? null })
    await get().fetchAssets()
  },

  deleteFolderAction: async (id) => {
    await api.deleteFolder(id)
    await get().fetchAssets()
  },

  renameFolderAction: async (id, name) => {
    await api.updateFolder(id, { name })
    await get().fetchAssets()
  },

  renameConnectionAction: async (id, name) => {
    await api.updateConnection(id, { name })
    await get().fetchAssets()
  },

  // 主菜单
  menuVariant: 'default',
  setMenuVariant: (v) => set({ menuVariant: v }),

  // 设置面板
  settingsOpen: false,
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),

  // SFTP 与服务器面板
  sftpOpen: false,
  toggleSftp: () => set((s) => ({ sftpOpen: !s.sftpOpen })),
  serverPanelOpen: false,
  toggleServerPanel: () => set((s) => ({ serverPanelOpen: !s.serverPanelOpen })),

  // SSH 配置编辑器
  sshConfigOpen: false,
  sshConfigMode: 'create',
  sshConfigInitialId: null,
  openSshConfig: (mode, id) => set({ sshConfigOpen: true, sshConfigMode: mode, sshConfigInitialId: id ?? null }),
  closeSshConfig: () => set({ sshConfigOpen: false, sshConfigInitialId: null }),
}))
