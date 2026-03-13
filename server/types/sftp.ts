/* ── SFTP 类型定义（后端） ── */

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
}

// ── WebSocket 消息协议 ──

/** 客户端 → 服务端 消息类型 */
export type SftpClientMessageType =
  | 'sftp-connect'
  | 'sftp-list'
  | 'sftp-mkdir'
  | 'sftp-rename'
  | 'sftp-delete'
  | 'sftp-stat'
  | 'sftp-read-file'
  | 'sftp-write-file'
  | 'sftp-upload-start'
  | 'sftp-upload-chunk'
  | 'sftp-upload-end'
  | 'sftp-download-start'
  | 'sftp-download-cancel'
  | 'sftp-chmod'
  | 'sftp-touch'
  | 'sftp-exec'
  | 'sftp-disconnect'

/** 服务端 → 客户端 消息类型 */
export type SftpServerMessageType =
  | 'sftp-ready'
  | 'sftp-list-result'
  | 'sftp-stat-result'
  | 'sftp-error'
  | 'sftp-upload-progress'
  | 'sftp-upload-ok'
  | 'sftp-download-chunk'
  | 'sftp-download-ok'
  | 'sftp-read-file-result'
  | 'sftp-write-file-ok'
  | 'sftp-mkdir-ok'
  | 'sftp-rename-ok'
  | 'sftp-delete-ok'
  | 'sftp-chmod-ok'
  | 'sftp-touch-ok'
  | 'sftp-exec-result'

/** 通用 WebSocket 消息 */
export interface SftpMessage<T = unknown> {
  type: SftpClientMessageType | SftpServerMessageType
  data?: T
  requestId?: string
}

// ── 各消息的 data 类型 ──

export interface SftpConnectData {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  connectionId?: string
  connectionName?: string
}

export interface SftpListData {
  path: string
}

export interface SftpMkdirData {
  path: string
}

export interface SftpRenameData {
  oldPath: string
  newPath: string
}

export interface SftpDeleteData {
  path: string
  isDir: boolean
}

export interface SftpStatData {
  path: string
}

export interface SftpReadFileData {
  path: string
  encoding?: string
}

export interface SftpWriteFileData {
  path: string
  content: string
  encoding?: string
}

export interface SftpUploadStartData {
  transferId: string
  remotePath: string
  fileName: string
  fileSize: number
}

export interface SftpUploadChunkData {
  transferId: string
  chunk: string // base64
  offset: number
}

export interface SftpUploadEndData {
  transferId: string
}

export interface SftpDownloadStartData {
  transferId: string
  remotePath: string
}

export interface SftpDownloadCancelData {
  transferId: string
}

export interface SftpChmodData {
  path: string
  /** 八进制权限，如 '755' */
  mode: string
  /** 是否递归应用到子目录/文件 */
  recursive?: boolean
}

export interface SftpTouchData {
  path: string
  /** 是否为目录（true 则 mkdir） */
  isDir?: boolean
}

/** exec 命令白名单前缀 */
export const EXEC_ALLOWED_COMMANDS = ['cp', 'mv', 'tar', 'zip', 'unzip', 'gzip', 'gunzip', 'chmod', 'chown', 'ln', 'cat', 'du', 'df'] as const

export interface SftpExecData {
  /** 完整命令字符串 */
  command: string
}
