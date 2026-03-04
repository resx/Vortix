export interface TreeItem {
  id: string
  name: string
  type: 'folder' | 'connection'
  protocol?: 'ssh' | 'sftp' | 'rdp' | 'docker' | 'database'
  isOpen?: boolean
  children?: TreeItem[]
}

export interface AssetRow {
  id: string
  name: string
  type: 'folder' | 'asset'
  protocol?: string
  latency: string
  host: string
  user: string
  created: string
  expire: string
  remark: string
  folderName?: string
}

export interface AppTab {
  id: string
  type: 'list' | 'asset'
  label: string
  assetRow?: AssetRow
  status: 'idle' | 'connecting' | 'connected' | 'closed' | 'error'
  /** 快速连接凭据（不保存到数据库） */
  quickConnect?: { host: string; port: number; username: string; password?: string; privateKey?: string }
  /** 数据库连接 ID */
  connectionId?: string
  /** 连接建立时间 */
  connectedAt?: string
  /** 错误信息 */
  errorMessage?: string
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

export interface TableContextData {
  targetContext: 'blank' | 'folder' | 'asset'
  rowData?: AssetRow
}

export interface TerminalContextData {
  tabId: string
  hasSelection: boolean
}

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  type: ContextMenuType | null
  data: TreeItem | TableContextData | TerminalContextData | null
}
