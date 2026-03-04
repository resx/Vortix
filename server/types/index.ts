/* ── 后端类型定义 ── */

// 统一 API 响应
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// 文件夹
export interface Folder {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateFolderDto {
  name: string
  parent_id?: string | null
  sort_order?: number
}

export interface UpdateFolderDto {
  name?: string
  parent_id?: string | null
  sort_order?: number
}

// SSH 连接
export interface Connection {
  id: string
  folder_id: string | null
  name: string
  protocol: 'ssh' | 'sftp' | 'rdp' | 'docker' | 'database'
  host: string
  port: number
  username: string
  auth_method: 'password' | 'key'
  has_password: boolean
  has_private_key: boolean
  sort_order: number
  remark: string
  created_at: string
  updated_at: string
}

// 内部使用，包含加密凭据
export interface ConnectionRow {
  id: string
  folder_id: string | null
  name: string
  protocol: string
  host: string
  port: number
  username: string
  auth_method: string
  encrypted_password: string | null
  encrypted_private_key: string | null
  sort_order: number
  remark: string
  created_at: string
  updated_at: string
}

export interface CreateConnectionDto {
  folder_id?: string | null
  name: string
  protocol?: string
  host: string
  port?: number
  username: string
  auth_method?: string
  password?: string
  private_key?: string
  remark?: string
}

export interface UpdateConnectionDto {
  folder_id?: string | null
  name?: string
  protocol?: string
  host?: string
  port?: number
  username?: string
  auth_method?: string
  password?: string | null
  private_key?: string | null
  remark?: string
}

// 解密后的凭据
export interface ConnectionCredential {
  host: string
  port: number
  username: string
  password?: string
  private_key?: string
}

// 设置
export interface SettingRow {
  key: string
  value: string // JSON 字符串
}

// 命令历史
export interface CommandHistory {
  id: number
  connection_id: string
  command: string
  executed_at: string
}

// 连接日志
export interface ConnectionLog {
  id: number
  connection_id: string
  event: 'connect' | 'disconnect' | 'error' | 'reconnect'
  message: string
  duration_ms: number | null
  created_at: string
}
