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
  color_tag: string | null
  environment: string
  auth_type: string
  proxy_type: string
  proxy_host: string
  proxy_port: number
  proxy_username: string
  proxy_password: string
  proxy_timeout: number
  jump_server_id: string | null
  tunnels: string
  env_vars: string
  advanced: string
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

// 批量编辑
export interface BatchUpdateConnectionDto {
  ids: string[]
  updates: {
    folder_id?: string | null
    color_tag?: string | null
    remark?: string
    environment?: string
    port?: number
    username?: string
    auth_type?: string
    password?: string
    proxy_type?: string
    proxy_host?: string
    proxy_port?: number
    proxy_username?: string
    proxy_password?: string
    proxy_timeout?: number
    jump_server_id?: string | null
    env_vars?: string
    advanced?: string
  }
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

// 最近连接（JOIN 查询结果）
export interface RecentConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  protocol: string
  color_tag: string | null
  folder_name: string | null
  last_connected_at: string
}

// 快捷命令
export interface Shortcut {
  id: string
  name: string
  command: string
  remark: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CreateShortcutDto {
  name: string
  command: string
  remark?: string
  sort_order?: number
}

export interface UpdateShortcutDto {
  name?: string
  command?: string
  remark?: string
  sort_order?: number
}

// ── 云同步 ──

/** 同步文件状态信息 */
export interface SyncFileInfo {
  exists: boolean
  lastModified: string | null
  size: number | null
}

/** 导入结果统计 */
export interface ImportResult {
  folders: number
  connections: number
  shortcuts: number
  sshKeys: number
}

/** 同步用 SSH 密钥（含明文私钥/密码短语，不含加密字段） */
export interface SyncSshKey {
  id: string
  name: string
  key_type: string
  private_key: string
  public_key: string | null
  passphrase: string | null
  certificate: string | null
  remark: string
  description: string
  created_at: string
}

/** 旧版同步文件内部 JSON 结构（v1/v2 二进制格式） */
export interface SyncPayloadLegacy {
  version: number
  exportedAt: string
  data: {
    folders: Folder[]
    connections: SyncConnection[]
    settings?: Record<string, unknown>
    shortcuts: Shortcut[]
    terminalProfiles?: unknown[]
    sshKeys?: SyncSshKey[]
  }
}

/** v3 同步文件元信息 */
export interface SyncMeta {
  revision: number
  lastSyncDeviceId: string
  encryptionSalt?: string
  /** 'builtin' = 内置密钥, 'user' = 用户自定义密钥, 缺失 = 旧版明文 */
  encryptionType?: 'builtin' | 'user'
}

/** v3 JSON 同步文件格式 */
export interface SyncPayloadV3 {
  $schema: 'vortix-sync'
  version: 3
  deviceId: string
  exportedAt: string
  checksum: string
  syncMeta: SyncMeta
  data: {
    folders: Folder[]
    connections: SyncConnection[]
    shortcuts: Shortcut[]
    sshKeys: SyncSshKey[]
  }
}

/** 本地同步状态（data/sync-state.json） */
export interface SyncState {
  deviceId: string
  lastSyncRevision: number
  lastSyncAt: string | null
  localDirty: boolean
}

/** 冲突检测结果 */
export interface SyncConflictInfo {
  hasConflict: boolean
  reason?: 'remote_ahead' | 'local_dirty'
  localRevision: number
  remoteRevision: number
  remoteDeviceId?: string
  remoteExportedAt?: string
}

/** 兼容新旧格式的统一 payload（内部使用） */
export type SyncPayload = SyncPayloadLegacy | SyncPayloadV3

// ── SSH 密钥库 ──

// ── 连接预设 ──

export interface Preset {
  id: string
  name: string
  username: string
  encrypted_password: string
  remark: string
  created_at: string
  updated_at: string
}

export interface PresetPublic {
  id: string
  name: string
  username: string
  remark: string
  created_at: string
  updated_at: string
}

export interface CreatePresetDto {
  name: string
  username: string
  password: string
  remark?: string
}

export interface UpdatePresetDto {
  name?: string
  username?: string
  password?: string
  remark?: string
}

export interface PresetCredential {
  username: string
  password: string
}

// ── SSH 密钥库 ──

export interface SshKey {
  id: string
  name: string
  key_type: string           // ed25519/ecdsa/rsa/ml-dsa/unknown
  public_key: string | null
  has_passphrase: boolean
  certificate: string | null
  remark: string
  description: string        // 系统标记，如 "[Generated by Vortix]"
  created_at: string
}

export interface SshKeyRow extends SshKey {
  encrypted_private_key: string
  encrypted_passphrase: string | null
}

export interface CreateSshKeyDto {
  name: string
  private_key: string
  public_key?: string
  passphrase?: string
  certificate?: string
  remark?: string
  key_type?: string
  description?: string
}

export interface UpdateSshKeyDto {
  name?: string
  public_key?: string | null
  private_key?: string
  passphrase?: string | null
  certificate?: string | null
  remark?: string
}

/** 同步用连接（含明文凭据，不含加密字段） */
export interface SyncConnection {
  id: string
  folder_id: string | null
  name: string
  protocol: string
  host: string
  port: number
  username: string
  auth_method: string
  password: string | null
  private_key: string | null
  sort_order: number
  remark: string
  color_tag: string | null
  environment: string
  auth_type: string
  proxy_type: string
  proxy_host: string
  proxy_port: number
  proxy_username: string
  proxy_password: string | null
  proxy_timeout: number
  jump_server_id: string | null
  tunnels: string
  env_vars: string
  advanced: string
  created_at: string
  updated_at: string
}
