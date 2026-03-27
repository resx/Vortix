/* ── SFTP 文件浏览状态 ── */

import { create } from 'zustand'
import type { SftpFileEntry, SftpSortField, SftpSortOrder } from '../types/sftp'

interface SftpState {
  // 连接状态
  connected: boolean
  connecting: boolean
  error: string | null
  connectionId: string
  connectionName: string
  reconnecting: boolean
  reconnectAttempt: number
  reconnectMax: number
  reconnectMessage: string | null

  // 路径导航
  currentPath: string
  homePath: string
  pathHistory: string[]
  historyIndex: number

  // 文件列表
  entries: SftpFileEntry[]
  loading: boolean

  // 排序
  sortField: SftpSortField
  sortOrder: SftpSortOrder

  // 选择
  selectedPaths: Set<string>

  // 视图
  viewMode: 'list' | 'grid'
  showHidden: boolean

  // 搜索
  searchQuery: string
  searchActive: boolean

  // 路径联动
  pathSyncEnabled: boolean

  // 内联重命名
  renamingPath: string | null

  // Actions
  setConnected: (connected: boolean) => void
  setConnecting: (connecting: boolean) => void
  setError: (error: string | null) => void
  setConnectionInfo: (id: string, name: string) => void
  setReconnectState: (payload: {
    reconnecting: boolean
    reconnectAttempt?: number
    reconnectMax?: number
    reconnectMessage?: string | null
  }) => void
  setHomePath: (home: string) => void
  navigateTo: (path: string) => void
  goBack: () => void
  goForward: () => void
  goHome: () => void
  goUp: () => void
  setEntries: (entries: SftpFileEntry[]) => void
  setLoading: (loading: boolean) => void
  setSortField: (field: SftpSortField) => void
  setSortOrder: (order: SftpSortOrder) => void
  toggleSort: (field: SftpSortField) => void
  selectPath: (path: string) => void
  toggleSelect: (path: string) => void
  selectRange: (paths: string[]) => void
  selectAll: () => void
  clearSelection: () => void
  setViewMode: (mode: 'list' | 'grid') => void
  setShowHidden: (show: boolean) => void
  setSearchQuery: (query: string) => void
  setSearchActive: (active: boolean) => void
  setPathSyncEnabled: (enabled: boolean) => void
  setRenamingPath: (path: string | null) => void
  removeHistoryPath: (path: string) => void
  clearHistory: () => void
  updateEntrySize: (path: string, size: number) => void
  reset: () => void
}

const MAX_HISTORY = 200

const initialState = {
  connected: false,
  connecting: false,
  error: null,
  connectionId: '',
  connectionName: '',
  reconnecting: false,
  reconnectAttempt: 0,
  reconnectMax: 0,
  reconnectMessage: null,
  currentPath: '/',
  homePath: '/',
  pathHistory: ['/'],
  historyIndex: 0,
  entries: [] as SftpFileEntry[],
  loading: false,
  sortField: 'name' as SftpSortField,
  sortOrder: 'asc' as SftpSortOrder,
  selectedPaths: new Set<string>(),
  viewMode: 'list' as const,
  showHidden: false,
  searchQuery: '',
  searchActive: false,
  pathSyncEnabled: false,
  renamingPath: null,
}

export const useSftpStore = create<SftpState>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setError: (error) => set({ error }),
  setConnectionInfo: (id, name) => set({ connectionId: id, connectionName: name }),
  setReconnectState: ({ reconnecting, reconnectAttempt, reconnectMax, reconnectMessage }) => set((state) => ({
    reconnecting,
    reconnectAttempt: reconnectAttempt ?? state.reconnectAttempt,
    reconnectMax: reconnectMax ?? state.reconnectMax,
    reconnectMessage: reconnectMessage ?? null,
  })),
  setHomePath: (home) => set({ homePath: home }),

  navigateTo: (path) => {
    const { pathHistory, historyIndex, currentPath } = get()
    if (path === currentPath) return
    // 截断前进历史，追加新路径
    const baseHistory = pathHistory.slice(0, historyIndex + 1)
    const nextHistory = baseHistory[baseHistory.length - 1] === path
      ? baseHistory
      : [...baseHistory, path]
    let nextIndex = nextHistory.length - 1
    // 控制历史长度，避免无上限增长
    if (nextHistory.length > MAX_HISTORY) {
      const overflow = nextHistory.length - MAX_HISTORY
      nextHistory.splice(0, overflow)
      nextIndex = Math.max(0, nextIndex - overflow)
    }
    set({
      currentPath: path,
      pathHistory: nextHistory,
      historyIndex: nextIndex,
      selectedPaths: new Set(),
    })
  },

  goBack: () => {
    const { pathHistory, historyIndex } = get()
    if (historyIndex <= 0) return
    const newIndex = historyIndex - 1
    set({
      currentPath: pathHistory[newIndex],
      historyIndex: newIndex,
      selectedPaths: new Set(),
    })
  },

  goForward: () => {
    const { pathHistory, historyIndex } = get()
    if (historyIndex >= pathHistory.length - 1) return
    const newIndex = historyIndex + 1
    set({
      currentPath: pathHistory[newIndex],
      historyIndex: newIndex,
      selectedPaths: new Set(),
    })
  },

  goHome: () => {
    get().navigateTo(get().homePath)
  },

  goUp: () => {
    const { currentPath } = get()
    if (currentPath === '/') return
    const parent = currentPath.replace(/\/[^/]+\/?$/, '') || '/'
    get().navigateTo(parent)
  },

  setEntries: (entries) => set({ entries }),
  setLoading: (loading) => set({ loading }),

  setSortField: (field) => set({ sortField: field }),
  setSortOrder: (order) => set({ sortOrder: order }),

  toggleSort: (field) => {
    const { sortField, sortOrder } = get()
    if (sortField === field) {
      set({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })
    } else {
      set({ sortField: field, sortOrder: 'asc' })
    }
  },

  selectPath: (path) => set({ selectedPaths: new Set([path]) }),
  toggleSelect: (path) => {
    const next = new Set(get().selectedPaths)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    set({ selectedPaths: next })
  },
  selectRange: (paths) => set({ selectedPaths: new Set(paths) }),
  selectAll: () => {
    const all = get().entries.map(e => e.path)
    set({ selectedPaths: new Set(all) })
  },
  clearSelection: () => set({ selectedPaths: new Set() }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setShowHidden: (show) => set({ showHidden: show }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchActive: (active) => set(active ? { searchActive: true } : { searchActive: false, searchQuery: '' }),
  setPathSyncEnabled: (enabled) => set({ pathSyncEnabled: enabled }),
  setRenamingPath: (path) => set({ renamingPath: path }),

  removeHistoryPath: (path) => {
    const { pathHistory, historyIndex, currentPath } = get()
    if (path === currentPath) return
    const nextHistory = pathHistory.filter(p => p !== path)
    if (nextHistory.length === 0) {
      set({ pathHistory: [currentPath], historyIndex: 0 })
      return
    }
    const removedBefore = pathHistory.slice(0, historyIndex).filter(p => p === path).length
    const nextIndex = Math.min(nextHistory.length - 1, Math.max(0, historyIndex - removedBefore))
    set({ pathHistory: nextHistory, historyIndex: nextIndex })
  },

  clearHistory: () => {
    const { currentPath } = get()
    set({ pathHistory: [currentPath], historyIndex: 0 })
  },

  updateEntrySize: (path, size) => {
    set((state) => ({
      entries: state.entries.map(e => (e.path === path ? { ...e, size } : e)),
    }))
  },

  reset: () => set({ ...initialState, selectedPaths: new Set() }),
}))
