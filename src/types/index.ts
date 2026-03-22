export interface TreeItem {
  id: string
  name: string
  type: 'folder' | 'connection'
  protocol?: 'ssh' | 'sftp' | 'rdp' | 'docker' | 'database' | 'local'
  colorTag?: string | null
  isOpen?: boolean
  children?: TreeItem[]
  command?: string
  remark?: string
}

export interface AssetRow {
  id: string
  name: string
  type: 'folder' | 'asset'
  protocol?: string
  colorTag?: string | null
  latency: string
  host: string
  user: string
  created: string
  expire: string
  remark: string
  folderId?: string | null
  folderName?: string
}

export interface AppTab {
  id: string
  type: 'list' | 'asset'
  label: string
  assetRow?: AssetRow
  status: 'idle' | 'connecting' | 'connected' | 'closed' | 'error'
  /** 快速连接凭据（不保存到数据库） */
  quickConnect?: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
    passphrase?: string
    terminalEnhance?: boolean
    jump?: {
      connectionId?: string
      connectionName?: string
      host: string
      port: number
      username: string
      password?: string
      privateKey?: string
      passphrase?: string
    }
  }
  /** 数据库连接 ID */
  connectionId?: string
  /** 连接建立时间 */
  connectedAt?: string
  /** 错误信息 */
  errorMessage?: string
  /** 重连 key，递增触发组件重新挂载 */
  reconnectKey?: number
  /** 非活跃标签页有新终端输出时标记 */
  hasActivity?: boolean
}

export type ListViewMode = 'list' | 'card' | 'thumbnail'

export type ActiveFilter = 'all' | 'ssh' | 'db' | 'docker' | 'shortcuts'

export type ContextMenuType =
  | 'sidebar-blank-shortcut'
  | 'sidebar-shortcut'
  | 'sidebar-blank-asset'
  | 'sidebar-asset'
  | 'table-context'
  | 'terminal'
  | 'tab-context'

export interface TableContextData {
  targetContext: 'blank' | 'folder' | 'asset'
  rowData?: AssetRow
  currentFolderId?: string | null
}

export interface TerminalContextData {
  tabId: string
  paneId: string
  hasSelection: boolean
}

export interface TabContextData {
  tabId: string
  tabIndex: number
}

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  type: ContextMenuType | null
  data: TreeItem | TableContextData | TerminalContextData | TabContextData | null
}
