import { create } from 'zustand'
import type { ContextMenuState } from '../types'

interface UIState {
  // 侧边栏
  isSidebarOpen: boolean
  toggleSidebar: () => void

  // 右键菜单
  contextMenu: ContextMenuState
  showContextMenu: (x: number, y: number, type: ContextMenuState['type'], data?: ContextMenuState['data']) => void
  hideContextMenu: () => void

  // 新建文件夹弹窗
  showDirModal: boolean
  dirName: string
  setShowDirModal: (v: boolean) => void
  setDirName: (v: string) => void

  // 新建菜单
  newMenuOpen: boolean
  setNewMenuOpen: (v: boolean) => void
  activeNewSubmenu: string | null
  setActiveNewSubmenu: (v: string | null) => void

  // 主菜单风格
  menuVariant: 'default' | 'glass'
  setMenuVariant: (v: 'default' | 'glass') => void

  // 设置面板
  settingsOpen: boolean
  settingsInitialNav: string | null
  toggleSettings: () => void
  setSettingsInitialNav: (nav: string | null) => void

  // SFTP 面板
  sftpOpen: boolean
  toggleSftp: () => void

  // 服务器面板
  serverPanelOpen: boolean
  toggleServerPanel: () => void

  // SSH 配置编辑器
  sshConfigOpen: boolean
  sshConfigMode: 'create' | 'edit'
  sshConfigInitialId: string | null
  sshConfigFromQuickConnect: boolean
  openSshConfig: (mode: 'create' | 'edit', id?: string, fromQuickConnect?: boolean) => void
  closeSshConfig: () => void

  // 本地终端配置编辑器
  localTermConfigOpen: boolean
  localTermConfigMode: 'create' | 'edit'
  localTermConfigInitialId: string | null
  openLocalTermConfig: (mode: 'create' | 'edit', id?: string) => void
  closeLocalTermConfig: () => void

  // 对话框
  quickSearchOpen: boolean
  toggleQuickSearch: () => void
  updateDialogOpen: boolean
  toggleUpdateDialog: () => void
  clearDataDialogOpen: boolean
  toggleClearDataDialog: () => void
  reloadDialogOpen: boolean
  toggleReloadDialog: () => void

  // 批量编辑
  batchEditOpen: boolean
  batchEditIds: string[]
  openBatchEdit: (ids: string[]) => void
  closeBatchEdit: () => void
}

export const useUIStore = create<UIState>((set) => ({
  // 侧边栏
  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  // 右键菜单
  contextMenu: { visible: false, x: 0, y: 0, type: null, data: null },
  showContextMenu: (x, y, type, data = null) => {
    set({ contextMenu: { visible: true, x, y, type, data } })
  },
  hideContextMenu: () =>
    set((s) => ({ contextMenu: { ...s.contextMenu, visible: false } })),

  // 新建文件夹弹窗
  showDirModal: false,
  dirName: '',
  setShowDirModal: (v) => set({ showDirModal: v, dirName: '' }),
  setDirName: (v) => set({ dirName: v }),

  // 新建菜单
  newMenuOpen: false,
  setNewMenuOpen: (v) => set({ newMenuOpen: v, activeNewSubmenu: null }),
  activeNewSubmenu: null,
  setActiveNewSubmenu: (v) => set({ activeNewSubmenu: v }),

  // 主菜单风格
  menuVariant: 'default',
  setMenuVariant: (v) => set({ menuVariant: v }),

  // 设置面板
  settingsOpen: false,
  settingsInitialNav: null,
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setSettingsInitialNav: (nav) => set({ settingsInitialNav: nav }),

  // SFTP 面板
  sftpOpen: false,
  toggleSftp: () => set((s) => ({ sftpOpen: !s.sftpOpen })),

  // 服务器面板
  serverPanelOpen: false,
  toggleServerPanel: () => set((s) => ({ serverPanelOpen: !s.serverPanelOpen })),

  // SSH 配置编辑器
  sshConfigOpen: false,
  sshConfigMode: 'create',
  sshConfigInitialId: null,
  sshConfigFromQuickConnect: false,
  openSshConfig: (mode, id, fromQuickConnect) => set({ sshConfigOpen: true, sshConfigMode: mode, sshConfigInitialId: id ?? null, sshConfigFromQuickConnect: !!fromQuickConnect }),
  closeSshConfig: () => set({ sshConfigOpen: false, sshConfigInitialId: null, sshConfigFromQuickConnect: false }),

  // 本地终端配置编辑器
  localTermConfigOpen: false,
  localTermConfigMode: 'create',
  localTermConfigInitialId: null,
  openLocalTermConfig: (mode, id) => set({ localTermConfigOpen: true, localTermConfigMode: mode, localTermConfigInitialId: id ?? null }),
  closeLocalTermConfig: () => set({ localTermConfigOpen: false, localTermConfigInitialId: null }),

  // 对话框
  quickSearchOpen: false,
  toggleQuickSearch: () => set((s) => ({ quickSearchOpen: !s.quickSearchOpen })),
  updateDialogOpen: false,
  toggleUpdateDialog: () => set((s) => ({ updateDialogOpen: !s.updateDialogOpen })),
  clearDataDialogOpen: false,
  toggleClearDataDialog: () => set((s) => ({ clearDataDialogOpen: !s.clearDataDialogOpen })),
  reloadDialogOpen: false,
  toggleReloadDialog: () => set((s) => ({ reloadDialogOpen: !s.reloadDialogOpen })),

  // 批量编辑
  batchEditOpen: false,
  batchEditIds: [],
  openBatchEdit: (ids) => set({ batchEditOpen: true, batchEditIds: ids }),
  closeBatchEdit: () => set({ batchEditOpen: false, batchEditIds: [] }),
}))