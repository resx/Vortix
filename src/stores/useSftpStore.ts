/* ── SFTP 文件浏览状态 ── */

import { create } from 'zustand'
import type { SftpFileEntry, SftpSortField, SftpSortOrder } from '../types/sftp'

interface SftpState {
  // 连接状态
  connected: boolean
  connecting: boolean
  error: string | null

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

  // Actions
  setConnected: (connected: boolean) => void
  setConnecting: (connecting: boolean) => void
  setError: (error: string | null) => void
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
  reset: () => void
}

const initialState = {
  connected: false,
  connecting: false,
  error: null,
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
}

export const useSftpStore = create<SftpState>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setError: (error) => set({ error }),
  setHomePath: (home) => set({ homePath: home }),

  navigateTo: (path) => {
    const { pathHistory, historyIndex } = get()
    // 截断前进历史，追加新路径
    const newHistory = [...pathHistory.slice(0, historyIndex + 1), path]
    set({
      currentPath: path,
      pathHistory: newHistory,
      historyIndex: newHistory.length - 1,
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

  reset: () => set({ ...initialState, selectedPaths: new Set() }),
}))
