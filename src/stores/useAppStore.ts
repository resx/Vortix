import { create } from 'zustand'
import type { TreeItem, ActiveFilter, ContextMenuState, AppTab, ListViewMode, AssetRow } from '../types'
import { ASSETS_DATA, SHORTCUTS_DATA, TABLE_DATA } from '../data/mock'

interface AppState {
  activeFilter: ActiveFilter
  setActiveFilter: (filter: ActiveFilter) => void

  isSidebarOpen: boolean
  toggleSidebar: () => void

  hideEmptyFolders: boolean
  toggleHideEmptyFolders: () => void

  assets: TreeItem[]
  shortcuts: TreeItem[]
  toggleFolder: (target: 'assets' | 'shortcuts', id: string) => void

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
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setListViewMode: (mode: ListViewMode) => void
  updateTabStatus: (id: string, status: AppTab['status']) => void
}

const toggleInTree = (items: TreeItem[], id: string): TreeItem[] =>
  items.map(item =>
    item.id === id ? { ...item, isOpen: !item.isOpen } : item
  )

export const useAppStore = create<AppState>((set) => ({
  activeFilter: 'all',
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  hideEmptyFolders: false,
  toggleHideEmptyFolders: () => set((s) => ({ hideEmptyFolders: !s.hideEmptyFolders })),

  assets: ASSETS_DATA,
  shortcuts: SHORTCUTS_DATA,
  toggleFolder: (target, id) =>
    set((state) => ({
      [target]: toggleInTree(state[target], id),
    })),

  contextMenu: { visible: false, x: 0, y: 0, type: null, data: null },
  showContextMenu: (x, y, type, data = null) => {
    let posY = y
    if (window.innerHeight - posY < 450) posY = Math.max(0, window.innerHeight - 450)
    set({ contextMenu: { visible: true, x, y: posY, type, data } })
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
      TABLE_DATA.forEach(row => {
        if (row.type === 'asset') {
          newPings[row.id] = Math.floor(Math.random() * 80 + 10) + 'ms'
        }
      })
      return { showPing: true, pings: newPings }
    }
    return { showPing: false }
  }),
  refreshPing: () => set(() => {
    const newPings: Record<string, string> = {}
    TABLE_DATA.forEach(row => {
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
    }
    return { tabs: [...s.tabs, newTab], activeTabId: newTab.id }
  }),

  closeTab: (id) => set((s) => {
    if (id === 'list') return {}
    const newTabs = s.tabs.filter(t => t.id !== id)
    const newActiveId = s.activeTabId === id ? 'list' : s.activeTabId
    return { tabs: newTabs, activeTabId: newActiveId }
  }),

  setActiveTab: (id) => set({ activeTabId: id }),

  setListViewMode: (mode) => set({ listViewMode: mode }),

  updateTabStatus: (id, status) => set((s) => ({
    tabs: s.tabs.map(t => t.id === id ? { ...t, status } : t),
  })),
}))
