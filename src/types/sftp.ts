/* ── SFTP 类型定义（前端） ── */

/** 文件条目 */
export interface SftpFileEntry {
  name: string
  path: string
  type: 'file' | 'dir' | 'symlink'
  size: number
  modifiedAt: string
  permissions: string
  owner: number
  group: number
}

/** 传输任务状态 */
export type TransferStatus = 'queued' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'

/** 传输任务 */
export interface TransferTask {
  id: string
  type: 'upload' | 'download'
  fileName: string
  remotePath: string
  fileSize: number
  bytesTransferred: number
  status: TransferStatus
  connectionId: string
  connectionName: string
  speed: number
  error?: string
  startedAt?: number
  completedAt?: number
}

/** SFTP WebSocket 消息 */
export interface SftpMessage<T = unknown> {
  type: string
  data?: T
  requestId?: string
}

/** 排序字段 */
export type SftpSortField = 'name' | 'size' | 'modifiedAt'

/** 排序方向 */
export type SftpSortOrder = 'asc' | 'desc'

/** 剪贴板操作类型 */
export type ClipboardAction = 'copy' | 'cut'

/** 剪贴板条目 */
export interface SftpClipboardItem {
  entry: SftpFileEntry
  action: ClipboardAction
  /** 来源目录路径 */
  sourcePath: string
}

/** 收藏路径条目 */
export interface BookmarkEntry {
  /** 远程路径 */
  path: string
  /** 显示名称（默认取最后一段目录名） */
  label: string
  /** 添加时间 */
  createdAt: string
}

/** exec 命令执行结果 */
export interface ExecResult {
  stdout: string
  stderr: string
  code: number
}
