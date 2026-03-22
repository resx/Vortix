import { create } from 'zustand'
import type { TreeItem, ActiveFilter, ContextMenuState, AppTab, ListViewMode, AssetRow } from '../types'
import type { RecentConnection, UpdateShortcutDto } from '../api/types'
import * as api from '../api/client'
import { useToastStore } from './useToastStore'
import { useUIStore } from './useUIStore'
import { useShortcutStore } from './useShortcutStore'
import { useTabStore } from './useTabStore'
import { useAssetStore } from './useAssetStore'

/** @deprecated 从 useToastStore 导入 */
export type { ToastItem } from './useToastStore'

interface AppState {
  // Toast 通知（代理 → useToastStore）
  /** @deprecated 使用 useToastStore */
  toasts: ToastItem[]
  /** @deprecated 使用 useToastStore */
  addToast: (type: 'success' | 'error', message: string) => void
  /** @deprecated 使用 useToastStore */
  removeToast: (id: string) => void

  /** @deprecated 使用 useAssetStore */
  activeFilter: ActiveFilter
  /** @deprecated 使用 useAssetStore */
  setActiveFilter: (filter: ActiveFilter) => void

  /** @deprecated 使用 useUIStore */
  isSidebarOpen: boolean
  /** @deprecated 使用 useUIStore */
  toggleSidebar: () => void

  /** @deprecated 使用 useAssetStore */
  assets: TreeItem[]
  /** @deprecated 使用 useShortcutStore */
  shortcuts: TreeItem[]
  /** @deprecated 使用 useAssetStore */
  tableData: AssetRow[]
  /** @deprecated 使用 useAssetStore */
  toggleFolder: (target: 'assets' | 'shortcuts', id: string) => void
  /** @deprecated 使用 useAssetStore */
  expandAllFolders: (target: 'assets' | 'shortcuts') => void
  /** @deprecated 使用 useAssetStore */
  collapseAllFolders: (target: 'assets' | 'shortcuts') => void

  /** @deprecated 使用 useAssetStore */
  selectedSidebarItemId: string | null
  /** @deprecated 使用 useAssetStore */
  setSelectedSidebarItemId: (id: string | null) => void

  // 数据加载
  /** @deprecated 使用 useAssetStore */
  isDataLoading: boolean
  /** @deprecated 使用 useAssetStore */
  dataError: string | null
  /** @deprecated 使用 useAssetStore */
  fetchAssets: () => Promise<void>
  /** @deprecated 使用 useShortcutStore */
  fetchShortcuts: () => Promise<void>

  /** @deprecated 使用 useShortcutStore */
  createShortcutAction: (name: string, command: string, remark?: string) => Promise<void>
  /** @deprecated 使用 useShortcutStore */
  deleteShortcutAction: (id: string) => Promise<void>
  /** @deprecated 使用 useShortcutStore */
  updateShortcutAction: (id: string, data: UpdateShortcutDto) => Promise<void>
  /** @deprecated 使用 useShortcutStore */
  executeShortcut: (command: string, mode: 'execute' | 'paste') => void

  /** @deprecated 使用 useShortcutStore */
  shortcutDialogOpen: boolean
  /** @deprecated 使用 useShortcutStore */
  shortcutDialogMode: 'create' | 'edit'
  /** @deprecated 使用 useShortcutStore */
  shortcutDialogInitialId: string | null
  /** @deprecated 使用 useShortcutStore */
  openShortcutDialog: (mode: 'create' | 'edit', id?: string) => void
  /** @deprecated 使用 useShortcutStore */
  closeShortcutDialog: () => void

  /** @deprecated 使用 useUIStore */
  contextMenu: ContextMenuState
  /** @deprecated 使用 useUIStore */
  showContextMenu: (x: number, y: number, type: ContextMenuState['type'], data?: ContextMenuState['data']) => void
  /** @deprecated 使用 useUIStore */
  hideContextMenu: () => void

  // 资产列表功能
  /** @deprecated 使用 useAssetStore */
  currentFolder: string | null
  /** @deprecated 使用 useAssetStore */
  setCurrentFolder: (id: string | null) => void

  /** @deprecated 使用 useAssetStore */
  isAnonymized: boolean
  /** @deprecated 使用 useAssetStore */
  toggleAnonymized: () => void

  /** @deprecated 使用 useAssetStore */
  isAssetHidden: boolean
  /** @deprecated 使用 useAssetStore */
  setAssetHidden: (v: boolean) => void

  /** @deprecated 使用 useAssetStore */
  showPing: boolean
  /** @deprecated 使用 useAssetStore */
  pings: Record<string, string>
  /** @deprecated 使用 useAssetStore */
  togglePing: () => Promise<void>
  /** @deprecated 使用 useAssetStore */
  refreshPing: () => Promise<void>

  /** @deprecated 使用 useUIStore */
  showDirModal: boolean
  /** @deprecated 使用 useUIStore */
  dirName: string
  /** @deprecated 使用 useUIStore */
  setShowDirModal: (v: boolean) => void
  /** @deprecated 使用 useUIStore */
  setDirName: (v: string) => void

  /** @deprecated 使用 useUIStore */
  newMenuOpen: boolean
  /** @deprecated 使用 useUIStore */
  setNewMenuOpen: (v: boolean) => void
  /** @deprecated 使用 useUIStore */
  activeNewSubmenu: string | null
  /** @deprecated 使用 useUIStore */
  setActiveNewSubmenu: (v: string | null) => void

  /** @deprecated 使用 useTabStore */
  tabs: AppTab[]
  /** @deprecated 使用 useTabStore */
  activeTabId: string
  /** @deprecated 使用 useTabStore */
  listViewMode: ListViewMode
  /** @deprecated 使用 useTabStore */
  openAssetTab: (row: AssetRow) => void
  /** @deprecated 使用 useTabStore */
  openQuickConnect: (config: { host: string; port: number; username: string; password?: string; privateKey?: string; passphrase?: string; terminalEnhance?: boolean }) => void
  /** @deprecated 使用 useTabStore */
  closeTab: (id: string) => void
  /** @deprecated 使用 useTabStore */
  setActiveTab: (id: string) => void
  /** @deprecated 使用 useTabStore */
  setListViewMode: (mode: ListViewMode) => void
  /** @deprecated 使用 useTabStore */
  reorderTab: (fromId: string, toId: string) => void
  /** @deprecated 使用 useTabStore */
  updateTabStatus: (id: string, status: AppTab['status']) => void
  /** @deprecated 使用 useTabStore */
  closeOtherTabs: (tabId: string) => void
  /** @deprecated 使用 useTabStore */
  closeAllTabs: () => void
  /** @deprecated 使用 useTabStore */
  closeLeftTabs: (tabId: string) => void
  /** @deprecated 使用 useTabStore */
  closeRightTabs: (tabId: string) => void
  /** @deprecated 使用 useTabStore */
  renameTab: (tabId: string, newLabel: string) => void
  /** @deprecated 使用 useTabStore */
  duplicateTab: (tabId: string) => void
  /** @deprecated 使用 useTabStore */
  reconnectTab: (tabId: string) => void
  /** @deprecated 使用 useTabStore */
  createTabFromPane: (sourceTabId: string, paneId: string) => string | null
  /** @deprecated 使用 useTabStore */
  syncTabWithRemainingPanes: (tabId: string) => void
  /** @deprecated 使用 useTabStore */
  updateTabStatus: (id: string, status: AppTab['status']) => void
  /** @deprecated 使用 useTabStore */
  openSplitTab: (rows: AssetRow[]) => void
  /** @deprecated 使用 useTabStore */
  serializeTabState: () => string

  // 连接 CRUD
  /** @deprecated 使用 useAssetStore */
  moveConnectionToFolder: (connectionId: string, folderId: string | null) => Promise<void>
  /** @deprecated 使用 useAssetStore */
  createConnectionAction: (data: api.CreateConnectionDto) => Promise<void>
  /** @deprecated 使用 useAssetStore */
  deleteConnectionAction: (id: string) => Promise<void>
  /** @deprecated 使用 useAssetStore */
  cloneConnectionAction: (id: string) => Promise<void>

  // 文件夹 CRUD
  /** @deprecated 使用 useAssetStore */
  createFolderAction: (name: string, parentId?: string | null) => Promise<void>
  /** @deprecated 使用 useAssetStore */
  deleteFolderAction: (id: string) => Promise<void>
  /** @deprecated 使用 useAssetStore */
  renameFolderAction: (id: string, name: string) => Promise<void>
  /** @deprecated 使用 useAssetStore */
  renameConnectionAction: (id: string, name: string) => Promise<void>

  /** @deprecated 使用 useUIStore */
  menuVariant: 'default' | 'glass'
  /** @deprecated 使用 useUIStore */
  setMenuVariant: (v: 'default' | 'glass') => void

  /** @deprecated 使用 useUIStore */
  settingsOpen: boolean
  /** @deprecated 使用 useUIStore */
  settingsInitialNav: string | null
  /** @deprecated 使用 useUIStore */
  toggleSettings: () => void
  /** @deprecated 使用 useUIStore */
  setSettingsInitialNav: (nav: string | null) => void

  /** @deprecated 使用 useUIStore */
  sftpOpen: boolean
  /** @deprecated 使用 useUIStore */
  toggleSftp: () => void
  /** @deprecated 使用 useUIStore */
  serverPanelOpen: boolean
  /** @deprecated 使用 useUIStore */
  toggleServerPanel: () => void

  /** @deprecated 使用 useUIStore */
  sshConfigOpen: boolean
  /** @deprecated 使用 useUIStore */
  sshConfigMode: 'create' | 'edit'
  /** @deprecated 使用 useUIStore */
  sshConfigInitialId: string | null
  /** @deprecated 使用 useUIStore */
  openSshConfig: (mode: 'create' | 'edit', id?: string) => void
  /** @deprecated 使用 useUIStore */
  closeSshConfig: () => void

  /** @deprecated 使用 useUIStore */
  localTermConfigOpen: boolean
  /** @deprecated 使用 useUIStore */
  localTermConfigMode: 'create' | 'edit'
  /** @deprecated 使用 useUIStore */
  localTermConfigInitialId: string | null
  /** @deprecated 使用 useUIStore */
  openLocalTermConfig: (mode: 'create' | 'edit', id?: string) => void
  /** @deprecated 使用 useUIStore */
  closeLocalTermConfig: () => void

  // 最近连接
  /** @deprecated 使用 useAssetStore */
  recentConnections: RecentConnection[]
  /** @deprecated 使用 useAssetStore */
  fetchRecentConnections: () => Promise<void>

  /** @deprecated 使用 useUIStore */
  quickSearchOpen: boolean
  /** @deprecated 使用 useUIStore */
  toggleQuickSearch: () => void
  /** @deprecated 使用 useUIStore */
  updateDialogOpen: boolean
  /** @deprecated 使用 useUIStore */
  toggleUpdateDialog: () => void
  /** @deprecated 使用 useUIStore */
  clearDataDialogOpen: boolean
  /** @deprecated 使用 useUIStore */
  toggleClearDataDialog: () => void
  /** @deprecated 使用 useUIStore */
  reloadDialogOpen: boolean
  /** @deprecated 使用 useUIStore */
  toggleReloadDialog: () => void

  // 资产多选
  /** @deprecated 使用 useAssetStore */
  selectedRowIds: Set<string>
  /** @deprecated 使用 useAssetStore */
  setSelectedRowIds: (ids: Set<string>) => void
  /** @deprecated 使用 useAssetStore */
  toggleRowSelection: (id: string) => void
  /** @deprecated 使用 useAssetStore */
  clearRowSelection: () => void
  /** @deprecated 使用 useAssetStore */
  batchOpenSelected: () => void
  /** @deprecated 使用 useTabStore */
  /** 同屏打开：多个连接在一个标签页内分屏 */
  openSplitTab: (rows: AssetRow[]) => void

  // 窗口状态序列化
  /** @deprecated 使用 useTabStore */
  serializeTabState: () => string
}

export const useAppStore = create<AppState>((set, get) => ({
  // Toast 通知（代理 → useToastStore，仅 action 转发）
  toasts: [],
  addToast: (type, message) => useToastStore.getState().addToast(type, message),
  removeToast: (id) => useToastStore.getState().removeToast(id),

  activeFilter: 'all',
  setActiveFilter: (filter) => useAssetStore.getState().setActiveFilter(filter),

  // 侧边栏（代理 → useUIStore）
  isSidebarOpen: true,
  toggleSidebar: () => useUIStore.getState().toggleSidebar(),

  assets: [],
  shortcuts: [],
  tableData: [],
  toggleFolder: (target, id) => useAssetStore.getState().toggleFolder(target, id),
  expandAllFolders: (target) => useAssetStore.getState().expandAllFolders(target),
  collapseAllFolders: (target) => useAssetStore.getState().collapseAllFolders(target),

  selectedSidebarItemId: null,
  setSelectedSidebarItemId: (id) => useAssetStore.getState().setSelectedSidebarItemId(id),

  // 数据加载
  isDataLoading: false,
  dataError: null,
  fetchAssets: async () => useAssetStore.getState().fetchAssets(),

  // 快捷命令（代理 → useShortcutStore）
  fetchShortcuts: async () => useShortcutStore.getState().fetchShortcuts(),
  createShortcutAction: async (name, command, remark) => useShortcutStore.getState().createShortcutAction(name, command, remark),
  deleteShortcutAction: async (id) => useShortcutStore.getState().deleteShortcutAction(id),
  updateShortcutAction: async (id, data) => useShortcutStore.getState().updateShortcutAction(id, data),
  executeShortcut: (command, mode) => useShortcutStore.getState().executeShortcut(command, mode),

  // 快捷命令对话框（代理 → useShortcutStore）
  shortcutDialogOpen: false,
  shortcutDialogMode: 'create',
  shortcutDialogInitialId: null,
  openShortcutDialog: (mode, id) => useShortcutStore.getState().openShortcutDialog(mode, id),
  closeShortcutDialog: () => useShortcutStore.getState().closeShortcutDialog(),

  // 右键菜单（代理 → useUIStore）
  contextMenu: { visible: false, x: 0, y: 0, type: null, data: null },
  showContextMenu: (x, y, type, data = null) => useUIStore.getState().showContextMenu(x, y, type, data),
  hideContextMenu: () => useUIStore.getState().hideContextMenu(),

  currentFolder: null,
  setCurrentFolder: (id) => useAssetStore.getState().setCurrentFolder(id),

  isAnonymized: false,
  toggleAnonymized: () => useAssetStore.getState().toggleAnonymized(),

  isAssetHidden: false,
  setAssetHidden: (v) => useAssetStore.getState().setAssetHidden(v),

  showPing: false,
  pings: {},
  togglePing: async () => useAssetStore.getState().togglePing(),
  refreshPing: async () => useAssetStore.getState().refreshPing(),

  // 新建文件夹弹窗（代理 → useUIStore）
  showDirModal: false,
  dirName: '',
  setShowDirModal: (v) => useUIStore.getState().setShowDirModal(v),
  setDirName: (v) => useUIStore.getState().setDirName(v),

  // 新建菜单（代理 → useUIStore）
  newMenuOpen: false,
  setNewMenuOpen: (v) => useUIStore.getState().setNewMenuOpen(v),
  activeNewSubmenu: null,
  setActiveNewSubmenu: (v) => useUIStore.getState().setActiveNewSubmenu(v),

  // 标签页系统（代理 → useTabStore）
  tabs: [{ id: 'list', type: 'list', label: '列表', status: 'idle' }],
  activeTabId: 'list',
  listViewMode: 'list',
  openAssetTab: (row) => useTabStore.getState().openAssetTab(row),
  openQuickConnect: (config) => useTabStore.getState().openQuickConnect(config),
  closeTab: (id) => useTabStore.getState().closeTab(id),
  setActiveTab: (id) => useTabStore.getState().setActiveTab(id),
  setListViewMode: (mode) => useTabStore.getState().setListViewMode(mode),
  reorderTab: (fromId, toId) => useTabStore.getState().reorderTab(fromId, toId),
  updateTabStatus: (id, status) => useTabStore.getState().updateTabStatus(id, status),
  closeOtherTabs: (tabId) => useTabStore.getState().closeOtherTabs(tabId),
  closeAllTabs: () => useTabStore.getState().closeAllTabs(),
  closeLeftTabs: (tabId) => useTabStore.getState().closeLeftTabs(tabId),
  closeRightTabs: (tabId) => useTabStore.getState().closeRightTabs(tabId),
  renameTab: (tabId, newLabel) => useTabStore.getState().renameTab(tabId, newLabel),
  duplicateTab: (tabId) => useTabStore.getState().duplicateTab(tabId),
  reconnectTab: (tabId) => useTabStore.getState().reconnectTab(tabId),
  createTabFromPane: (sourceTabId, paneId) => useTabStore.getState().createTabFromPane(sourceTabId, paneId),
  syncTabWithRemainingPanes: (tabId) => useTabStore.getState().syncTabWithRemainingPanes(tabId),

  // 连接 CRUD（代理 → useAssetStore）
  moveConnectionToFolder: async (connectionId, folderId) => useAssetStore.getState().moveConnectionToFolder(connectionId, folderId),
  createConnectionAction: async (data) => useAssetStore.getState().createConnectionAction(data),
  deleteConnectionAction: async (id) => useAssetStore.getState().deleteConnectionAction(id),
  cloneConnectionAction: async (id) => useAssetStore.getState().cloneConnectionAction(id),

  // 文件夹 CRUD（代理 → useAssetStore）
  createFolderAction: async (name, parentId) => useAssetStore.getState().createFolderAction(name, parentId),
  deleteFolderAction: async (id) => useAssetStore.getState().deleteFolderAction(id),
  renameFolderAction: async (id, name) => useAssetStore.getState().renameFolderAction(id, name),
  renameConnectionAction: async (id, name) => useAssetStore.getState().renameConnectionAction(id, name),

  // 主菜单（代理 → useUIStore）
  menuVariant: 'default',
  setMenuVariant: (v) => useUIStore.getState().setMenuVariant(v),

  // 设置面板（代理 → useUIStore）
  settingsOpen: false,
  settingsInitialNav: null,
  toggleSettings: () => useUIStore.getState().toggleSettings(),
  setSettingsInitialNav: (nav) => useUIStore.getState().setSettingsInitialNav(nav),

  // SFTP 与服务器面板（代理 → useUIStore）
  sftpOpen: false,
  toggleSftp: () => useUIStore.getState().toggleSftp(),
  serverPanelOpen: false,
  toggleServerPanel: () => useUIStore.getState().toggleServerPanel(),

  // SSH 配置编辑器（代理 → useUIStore）
  sshConfigOpen: false,
  sshConfigMode: 'create',
  sshConfigInitialId: null,
  openSshConfig: (mode, id) => useUIStore.getState().openSshConfig(mode, id),
  closeSshConfig: () => useUIStore.getState().closeSshConfig(),

  // 本地终端配置编辑器（代理 → useUIStore）
  localTermConfigOpen: false,
  localTermConfigMode: 'create',
  localTermConfigInitialId: null,
  openLocalTermConfig: (mode, id) => useUIStore.getState().openLocalTermConfig(mode, id),
  closeLocalTermConfig: () => useUIStore.getState().closeLocalTermConfig(),

  // 最近连接（代理 → useAssetStore）
  recentConnections: [],
  fetchRecentConnections: async () => useAssetStore.getState().fetchRecentConnections(),

  // 对话框状态（代理 → useUIStore）
  quickSearchOpen: false,
  toggleQuickSearch: () => useUIStore.getState().toggleQuickSearch(),
  updateDialogOpen: false,
  toggleUpdateDialog: () => useUIStore.getState().toggleUpdateDialog(),
  clearDataDialogOpen: false,
  toggleClearDataDialog: () => useUIStore.getState().toggleClearDataDialog(),
  reloadDialogOpen: false,
  toggleReloadDialog: () => useUIStore.getState().toggleReloadDialog(),

  // 资产多选（代理 → useAssetStore）
  selectedRowIds: new Set<string>(),
  setSelectedRowIds: (ids) => useAssetStore.getState().setSelectedRowIds(ids),
  toggleRowSelection: (id) => useAssetStore.getState().toggleRowSelection(id),
  clearRowSelection: () => useAssetStore.getState().clearRowSelection(),
  batchOpenSelected: () => useAssetStore.getState().batchOpenSelected(),

  // 标签页代理（代理 → useTabStore）
  openSplitTab: (rows) => useTabStore.getState().openSplitTab(rows),

  serializeTabState: () => useTabStore.getState().serializeTabState(),
}))
