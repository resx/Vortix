import { create } from 'zustand'
import type { TreeItem, ActiveFilter, ContextMenuState, AppTab, ListViewMode, AssetRow } from '../types'
import * as api from '../api/client'
import type { Folder, Connection, RecentConnection, CreateShortcutDto, UpdateShortcutDto } from '../api/types'
import { useWorkspaceStore } from './useWorkspaceStore'
import { destroySession, getSession } from './terminalSessionRegistry'

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
  fetchShortcuts: () => Promise<void>

  // 快捷命令 CRUD
  createShortcutAction: (name: string, command: string, remark?: string) => Promise<void>
  deleteShortcutAction: (id: string) => Promise<void>
  updateShortcutAction: (id: string, data: UpdateShortcutDto) => Promise<void>
  executeShortcut: (command: string, mode: 'execute' | 'paste') => void

  // 快捷命令对话框
  shortcutDialogOpen: boolean
  shortcutDialogMode: 'create' | 'edit'
  shortcutDialogInitialId: string | null
  openShortcutDialog: (mode: 'create' | 'edit', id?: string) => void
  closeShortcutDialog: () => void

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
  togglePing: () => Promise<void>
  refreshPing: () => Promise<void>

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
  closeOtherTabs: (tabId: string) => void
  closeAllTabs: () => void
  closeLeftTabs: (tabId: string) => void
  closeRightTabs: (tabId: string) => void
  renameTab: (tabId: string, newLabel: string) => void
  duplicateTab: (tabId: string) => void
  reconnectTab: (tabId: string) => void
  /** 从分屏面板创建独立标签页（保留会话，不重新连接） */
  createTabFromPane: (sourceTabId: string, paneId: string) => string | null
  /** 提取 pane 后，同步源标签页信息（若仅剩一个带 meta 的 pane，更新标签页标题和连接信息） */
  syncTabWithRemainingPanes: (tabId: string) => void
  updateTabStatus: (id: string, status: AppTab['status']) => void

  // 连接 CRUD
  moveConnectionToFolder: (connectionId: string, folderId: string | null) => Promise<void>
  createConnectionAction: (data: api.CreateConnectionDto) => Promise<void>
  deleteConnectionAction: (id: string) => Promise<void>
  cloneConnectionAction: (id: string) => Promise<void>

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
  settingsInitialNav: string | null
  toggleSettings: () => void
  setSettingsInitialNav: (nav: string | null) => void

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

  // 本地终端配置编辑器
  localTermConfigOpen: boolean
  localTermConfigMode: 'create' | 'edit'
  localTermConfigInitialId: string | null
  openLocalTermConfig: (mode: 'create' | 'edit', id?: string) => void
  closeLocalTermConfig: () => void

  // 最近连接
  recentConnections: RecentConnection[]
  fetchRecentConnections: () => Promise<void>

  // 对话框状态
  quickSearchOpen: boolean
  toggleQuickSearch: () => void
  updateDialogOpen: boolean
  toggleUpdateDialog: () => void
  clearDataDialogOpen: boolean
  toggleClearDataDialog: () => void
  reloadDialogOpen: boolean
  toggleReloadDialog: () => void

  // 资产多选
  selectedRowIds: Set<string>
  setSelectedRowIds: (ids: Set<string>) => void
  toggleRowSelection: (id: string) => void
  clearRowSelection: () => void
  batchOpenSelected: () => void

  // 窗口状态序列化
  serializeTabState: () => string
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
        colorTag: c.color_tag,
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
      colorTag: c.color_tag,
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
    colorTag: c.color_tag,
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

  fetchShortcuts: async () => {
    try {
      const data = await api.getShortcuts()
      const items: TreeItem[] = data.map(s => ({
        id: s.id,
        name: s.name,
        type: 'connection' as const,
        command: s.command,
        remark: s.remark,
      }))
      set({ shortcuts: items })
    } catch {
      // 静默失败
    }
  },

  // 快捷命令 CRUD
  createShortcutAction: async (name, command, remark) => {
    await api.createShortcut({ name, command, remark })
    await get().fetchShortcuts()
  },

  deleteShortcutAction: async (id) => {
    await api.deleteShortcut(id)
    await get().fetchShortcuts()
  },

  updateShortcutAction: async (id, data) => {
    await api.updateShortcut(id, data)
    await get().fetchShortcuts()
  },

  executeShortcut: (command, mode) => {
    const { activeTabId } = get()
    const session = getSession(activeTabId)
    // 尝试从工作区获取活跃 pane 的 session
    const wsStore = useWorkspaceStore.getState()
    const paneIds = wsStore.getAllPaneIds(activeTabId)
    let ws: WebSocket | null = null
    // 优先使用第一个有活跃 ws 的 pane
    for (const pid of paneIds) {
      const s = getSession(pid)
      if (s?.ws?.readyState === WebSocket.OPEN) {
        ws = s.ws
        break
      }
    }
    // 回退到直接用 tabId 查找
    if (!ws && session?.ws?.readyState === WebSocket.OPEN) {
      ws = session.ws
    }
    if (ws) {
      if (mode === 'execute') {
        // 执行模式：合并多行为单行
        // 先修复被换行拆开的操作符（&& || \续行），再合并剩余换行
        const normalized = command
          .replace(/\\\s*\n\s*/g, '')
          .replace(/&\s*\n\s*&/g, '&&')
          .replace(/\|\s*\n\s*\|/g, '||')
          .replace(/\s*\n\s*/g, ' ')
          .trim()
        ws.send(JSON.stringify({ type: 'input', data: normalized + '\r' }))
      } else {
        // 粘贴模式：保持原始格式
        const isMultiLine = command.includes('\n')
        if (isMultiLine) {
          const PASTE_START = '\x1b[200~'
          const PASTE_END = '\x1b[201~'
          const text = command.replace(/\n/g, '\r')
          ws.send(JSON.stringify({ type: 'input', data: PASTE_START + text + PASTE_END }))
        } else {
          ws.send(JSON.stringify({ type: 'input', data: command }))
        }
      }
    }
  },

  // 快捷命令对话框
  shortcutDialogOpen: false,
  shortcutDialogMode: 'create',
  shortcutDialogInitialId: null,
  openShortcutDialog: (mode, id) => set({ shortcutDialogOpen: true, shortcutDialogMode: mode, shortcutDialogInitialId: id ?? null }),
  closeShortcutDialog: () => set({ shortcutDialogOpen: false, shortcutDialogInitialId: null }),

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
  togglePing: async () => {
    const { showPing, tableData } = get()
    if (showPing) {
      set({ showPing: false, pings: {} })
      return
    }
    // 收集所有 asset 类型的 ID
    const ids = tableData.filter(r => r.type === 'asset' && r.protocol !== 'local').map(r => r.id)
    if (ids.length === 0) {
      set({ showPing: true, pings: {} })
      return
    }
    set({ showPing: true })
    try {
      const result = await api.pingConnections(ids)
      const newPings: Record<string, string> = {}
      for (const [id, ms] of Object.entries(result)) {
        newPings[id] = ms !== null ? `${ms}ms` : '超时'
      }
      set({ pings: newPings })
    } catch {
      // 请求失败时显示全部超时
      const newPings: Record<string, string> = {}
      ids.forEach(id => { newPings[id] = '超时' })
      set({ pings: newPings })
    }
  },
  refreshPing: async () => {
    const { tableData } = get()
    const ids = tableData.filter(r => r.type === 'asset' && r.protocol !== 'local').map(r => r.id)
    if (ids.length === 0) return
    try {
      const result = await api.pingConnections(ids)
      const newPings: Record<string, string> = {}
      for (const [id, ms] of Object.entries(result)) {
        newPings[id] = ms !== null ? `${ms}ms` : '超时'
      }
      set({ pings: newPings })
    } catch {
      // 静默失败
    }
  },

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
    // 计算序号：统计同名标签数量
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
    // 销毁该 tab 关联的所有终端会话
    const wsStore = useWorkspaceStore.getState()
    const paneIds = wsStore.getAllPaneIds(tabId)
    paneIds.forEach((pid: string) => destroySession(pid))
    // 移除工作区（重新挂载时会自动初始化）
    wsStore.removeWorkspace(tabId)
    // 更新 tab 状态，递增 reconnectKey 强制重新挂载
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

  cloneConnectionAction: async (id) => {
    try {
      // 获取完整连接配置 + 解密凭据
      const [conn, cred] = await Promise.all([
        api.getConnection(id),
        api.getConnectionCredential(id),
      ])
      // 生成克隆名称：原名 + " (副本)" / " (副本 2)" ...
      const { tableData } = get()
      const baseName = conn.name.replace(/\s*\(副本(?:\s*\d+)?\)$/, '')
      const existingNames = new Set(tableData.map(r => r.name))
      let cloneName = `${baseName} (副本)`
      let i = 2
      while (existingNames.has(cloneName)) {
        cloneName = `${baseName} (副本 ${i++})`
      }
      await api.createConnection({
        folder_id: conn.folder_id,
        name: cloneName,
        protocol: conn.protocol,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        auth_method: conn.auth_method,
        password: cred.password,
        private_key: cred.private_key,
        remark: conn.remark,
        color_tag: conn.color_tag,
        environment: conn.environment,
        auth_type: conn.auth_type,
        proxy_type: conn.proxy_type,
        proxy_host: conn.proxy_host,
        proxy_port: conn.proxy_port,
        proxy_username: conn.proxy_username,
        proxy_password: cred.proxy_password,
        proxy_timeout: conn.proxy_timeout,
        jump_server_id: conn.jump_server_id,
        tunnels: JSON.stringify(conn.tunnels),
        env_vars: JSON.stringify(conn.env_vars),
        advanced: JSON.stringify(conn.advanced),
      })
      await get().fetchAssets()
    } catch (e) {
      console.error('克隆连接失败:', e)
    }
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
  settingsInitialNav: null,
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setSettingsInitialNav: (nav) => set({ settingsInitialNav: nav }),

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

  // 本地终端配置编辑器
  localTermConfigOpen: false,
  localTermConfigMode: 'create',
  localTermConfigInitialId: null,
  openLocalTermConfig: (mode, id) => set({ localTermConfigOpen: true, localTermConfigMode: mode, localTermConfigInitialId: id ?? null }),
  closeLocalTermConfig: () => set({ localTermConfigOpen: false, localTermConfigInitialId: null }),

  // 最近连接
  recentConnections: [],
  fetchRecentConnections: async () => {
    try {
      const data = await api.getRecentConnections()
      set({ recentConnections: data })
    } catch {
      // 静默失败
    }
  },

  // 对话框状态
  quickSearchOpen: false,
  toggleQuickSearch: () => set((s) => ({ quickSearchOpen: !s.quickSearchOpen })),
  updateDialogOpen: false,
  toggleUpdateDialog: () => set((s) => ({ updateDialogOpen: !s.updateDialogOpen })),
  clearDataDialogOpen: false,
  toggleClearDataDialog: () => set((s) => ({ clearDataDialogOpen: !s.clearDataDialogOpen })),
  reloadDialogOpen: false,
  toggleReloadDialog: () => set((s) => ({ reloadDialogOpen: !s.reloadDialogOpen })),

  // 资产多选
  selectedRowIds: new Set<string>(),
  setSelectedRowIds: (ids) => set({ selectedRowIds: ids }),
  toggleRowSelection: (id) => set((s) => {
    const next = new Set(s.selectedRowIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { selectedRowIds: next }
  }),
  clearRowSelection: () => set({ selectedRowIds: new Set<string>() }),
  batchOpenSelected: () => {
    const { selectedRowIds, tableData, openAssetTab } = get()
    for (const id of selectedRowIds) {
      const row = tableData.find(r => r.id === id && r.type === 'asset')
      if (row) openAssetTab(row)
    }
  },

  // 窗口状态序列化
  serializeTabState: () => {
    const { tabs, activeTabId } = get()
    const serializable = tabs.map(t => ({
      id: t.id, type: t.type, label: t.label,
      connectionId: t.connectionId,
      assetRow: t.assetRow,
      quickConnect: t.quickConnect,
    }))
    return JSON.stringify({ tabs: serializable, activeTabId })
  },
}))
