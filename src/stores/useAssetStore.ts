import { create } from 'zustand'
import type { TreeItem, ActiveFilter, AssetRow } from '../types'
import type { Folder, Connection, RecentConnection, CreateConnectionDto } from '../api/types'
import * as api from '../api/client'
import { useTabStore } from './useTabStore'

// ── 辅助函数 ──

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
    id: f.id, name: f.name, type: 'folder',
    latency: '-', host: '-', user: '-',
    created: f.created_at.replace('T', ' ').slice(0, 16),
    expire: '-', remark: '-',
  }))
  const connectionRows: AssetRow[] = connections.map(c => ({
    id: c.id, name: c.name, type: 'asset',
    protocol: c.protocol, colorTag: c.color_tag,
    latency: '-', host: c.host, user: c.username,
    created: c.created_at.replace('T', ' ').slice(0, 16),
    expire: '-', remark: c.remark || '-',
    folderId: c.folder_id,
    folderName: c.folder_id ? folderMap.get(c.folder_id) : undefined,
  }))
  return [...folderRows, ...connectionRows]
}

// ── 接口 ──

interface AssetState {
  activeFilter: ActiveFilter
  setActiveFilter: (filter: ActiveFilter) => void

  assets: TreeItem[]
  tableData: AssetRow[]
  toggleFolder: (target: 'assets' | 'shortcuts', id: string) => void
  expandAllFolders: (target: 'assets' | 'shortcuts') => void
  collapseAllFolders: (target: 'assets' | 'shortcuts') => void

  selectedSidebarItemId: string | null
  setSelectedSidebarItemId: (id: string | null) => void

  isDataLoading: boolean
  dataError: string | null
  fetchAssets: () => Promise<void>

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

  // 连接 CRUD
  moveConnectionToFolder: (connectionId: string, folderId: string | null) => Promise<void>
  createConnectionAction: (data: CreateConnectionDto) => Promise<void>
  deleteConnectionAction: (id: string) => Promise<void>
  cloneConnectionAction: (id: string) => Promise<void>

  // 文件夹 CRUD
  createFolderAction: (name: string, parentId?: string | null) => Promise<void>
  deleteFolderAction: (id: string) => Promise<void>
  renameFolderAction: (id: string, name: string) => Promise<void>
  renameConnectionAction: (id: string, name: string) => Promise<void>

  // 最近连接
  recentConnections: RecentConnection[]
  fetchRecentConnections: () => Promise<void>

  // 资产多选
  selectedRowIds: Set<string>
  setSelectedRowIds: (ids: Set<string>) => void
  toggleRowSelection: (id: string) => void
  clearRowSelection: () => void
  batchOpenSelected: () => void
}
export const useAssetStore = create<AssetState>((set, get) => ({
  activeFilter: 'all',
  setActiveFilter: (filter) => set({ activeFilter: filter }),

  assets: [],
  tableData: [],
  toggleFolder: (target, id) => {
    if (target !== 'assets') return
    set((s) => ({ assets: toggleInTree(s.assets, id) }))
  },
  expandAllFolders: (target) => {
    if (target !== 'assets') return
    set((s) => ({ assets: s.assets.map(item => item.type === 'folder' ? { ...item, isOpen: true } : item) }))
  },
  collapseAllFolders: (target) => {
    if (target !== 'assets') return
    set((s) => ({ assets: s.assets.map(item => item.type === 'folder' ? { ...item, isOpen: false } : item) }))
  },

  selectedSidebarItemId: null,
  setSelectedSidebarItemId: (id) => set({ selectedSidebarItemId: id }),

  isDataLoading: false,
  dataError: null,
  fetchAssets: async () => {
    set({ isDataLoading: true, dataError: null })
    try {
      const [folders, connections] = await Promise.all([
        api.getFolders(),
        api.getConnections(),
      ])
      const prevAssets = get().assets
      const openIds = new Set(
        prevAssets.filter(item => item.type === 'folder' && item.isOpen).map(item => item.id)
      )
      const newAssets = buildTree(folders, connections).map(item =>
        item.type === 'folder' && openIds.has(item.id) ? { ...item, isOpen: true } : item
      )
      set({ assets: newAssets, tableData: buildTableData(folders, connections), isDataLoading: false })
    } catch (e) {
      set({ isDataLoading: false, dataError: (e as Error).message })
    }
  },

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
    if (showPing) { set({ showPing: false, pings: {} }); return }
    const ids = tableData.filter(r => r.type === 'asset' && r.protocol !== 'local').map(r => r.id)
    if (ids.length === 0) { set({ showPing: true, pings: {} }); return }
    set({ showPing: true })
    try {
      const result = await api.pingConnections(ids)
      const newPings: Record<string, string> = {}
      for (const [id, ms] of Object.entries(result)) {
        newPings[id] = ms !== null ? `${ms}ms` : '超时'
      }
      set({ pings: newPings })
    } catch {
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
    useTabStore.getState().closeTabsByConnectionId(id)
    await get().fetchAssets()
  },
  cloneConnectionAction: async (id) => {
    try {
      const conn = await api.getConnection(id)
      const { tableData } = get()
      const baseName = conn.name.replace(/\s*\(副本(?:\s*\d+)?\)$/, '')
      const existingNames = new Set(tableData.map(r => r.name))
      let cloneName = `${baseName} (副本)`
      let i = 2
      while (existingNames.has(cloneName)) {
        cloneName = `${baseName} (副本 ${i++})`
      }
      const toJsonString = (value: unknown) => {
        if (value === null || value === undefined) return undefined
        if (typeof value === 'string') return value
        return JSON.stringify(value)
      }
      if (conn.protocol === 'local') {
        await api.createConnection({
          folder_id: conn.folder_id,
          name: cloneName,
          protocol: conn.protocol,
          host: conn.host && conn.host.trim() && conn.host !== 'localhost' && conn.host !== 'local' ? conn.host : '-',
          username: conn.username || '',
          remark: conn.remark,
          color_tag: conn.color_tag,
          advanced: toJsonString(conn.advanced),
        })
      } else {
        const cred = await api.getConnectionCredential(id).catch(() => null)
        await api.createConnection({
          folder_id: conn.folder_id, name: cloneName, protocol: conn.protocol,
          host: conn.host, port: conn.port, username: conn.username,
          auth_method: conn.auth_method, password: cred?.password,
          private_key: cred?.private_key, remark: conn.remark,
          color_tag: conn.color_tag, environment: conn.environment,
          auth_type: conn.auth_type, proxy_type: conn.proxy_type,
          proxy_host: conn.proxy_host, proxy_port: conn.proxy_port,
          proxy_username: conn.proxy_username, proxy_password: cred?.proxy_password,
          proxy_timeout: conn.proxy_timeout, jump_server_id: conn.jump_server_id,
          preset_id: conn.preset_id,
          private_key_id: conn.private_key_id,
          jump_key_id: conn.jump_key_id,
          tunnels: toJsonString(conn.tunnels),
          env_vars: toJsonString(conn.env_vars),
          advanced: toJsonString(conn.advanced),
        })
      }
      await get().fetchAssets()
    } catch (e) {
      console.error('克隆连接失败:', e)
      throw e
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
    const { selectedRowIds, tableData } = get()
    for (const id of selectedRowIds) {
      const row = tableData.find(r => r.id === id && r.type === 'asset')
      if (row) useTabStore.getState().openAssetTab(row)
    }
  },
}))
