/* ── API 请求/响应类型定义 ── */

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
  color_tag: string | null
  environment: string
  auth_type: string
  proxy_type: string
  proxy_host: string
  proxy_port: number
  proxy_username: string
  proxy_timeout: number
  jump_server_id: string | null
  tunnels: unknown[]
  env_vars: unknown[]
  advanced: Record<string, unknown>
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
  color_tag?: string | null
  environment?: string
  auth_type?: string
  proxy_type?: string
  proxy_host?: string
  proxy_port?: number
  proxy_username?: string
  proxy_password?: string
  proxy_timeout?: number
  jump_server_id?: string | null
  tunnels?: string
  env_vars?: string
  advanced?: string
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
  color_tag?: string | null
  environment?: string
  auth_type?: string
  proxy_type?: string
  proxy_host?: string
  proxy_port?: number
  proxy_username?: string
  proxy_password?: string | null
  proxy_timeout?: number
  jump_server_id?: string | null
  tunnels?: string
  env_vars?: string
  advanced?: string
}

// 解密后的凭据
export interface ConnectionCredential {
  host: string
  port: number
  username: string
  password?: string
  private_key?: string
  proxy_password?: string
}

// 设置
export type Settings = Record<string, unknown>

// 命令历史
export interface CommandHistory {
  id: number
  connection_id: string
  command: string
  executed_at: string
}
