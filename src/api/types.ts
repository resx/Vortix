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
  protocol: 'ssh' | 'sftp' | 'rdp' | 'docker' | 'database' | 'local'
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
  preset_id: string | null
  private_key_id: string | null
  jump_key_id: string | null
  has_passphrase: boolean
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
  preset_id?: string | null
  private_key_id?: string | null
  jump_key_id?: string | null
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
  preset_id?: string | null
  private_key_id?: string | null
  jump_key_id?: string | null
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
  passphrase?: string
  jump_private_key?: string
  jump_passphrase?: string
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

// 测试连接结果
export interface TestResult {
  success: boolean
  message?: string
  error?: string
}

// 最近连接
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

// 清理结果
export interface CleanupResult {
  deleted: number
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

// ── 连接预设 ──

export interface CustomThemePublic {
  id: string
  name: string
  mode: 'light' | 'dark'
  version: number
  author: string
  terminal: Record<string, string | undefined>
  highlights: Record<string, string>
  ui?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface CreateCustomThemeDto {
  name: string
  mode: 'light' | 'dark'
  terminal: Record<string, string | undefined>
  highlights: Record<string, string>
  ui?: Record<string, unknown>
  author?: string
}

export interface UpdateCustomThemeDto {
  name?: string
  mode?: 'light' | 'dark'
  terminal?: Record<string, string | undefined>
  highlights?: Record<string, string>
  ui?: Record<string, unknown> | null
}

export interface ImportThemesResult {
  format: string
  themes: CustomThemePublic[]
  errors: string[]
}

export interface PresetPublic {
  id: string
  name: string
  username: string
  remark: string
  created_at: string
  updated_at: string
}

export interface PresetCredential {
  username: string
  password: string
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

// ── SSH 密钥库 ──

export interface SshKey {
  id: string
  name: string
  key_type: string
  public_key: string | null
  has_passphrase: boolean
  certificate: string | null
  remark: string
  description: string
  created_at: string
}

export interface CreateSshKeyDto {
  name: string
  private_key: string
  public_key?: string
  passphrase?: string
  certificate?: string
  remark?: string
}

export interface UpdateSshKeyDto {
  name?: string
  public_key?: string | null
  private_key?: string
  passphrase?: string | null
  certificate?: string | null
  remark?: string
}

export interface GenerateSshKeyDto {
  name: string
  type: string
  bits?: number
  passphrase?: string
  comment?: string
}

// ── 云同步 ──

/** 同步文件状态信息 */
export interface SyncFileInfo {
  exists: boolean
  lastModified: string | null
  size: number | null
}

export interface SyncLocalState {
  localDirty: boolean
  lastSyncRevision: number
  lastSyncAt: string | null
}

/** 导入结果统计 */
export interface ImportResult {
  folders: number
  connections: number
  shortcuts: number
  sshKeys: number
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

/** 同步请求体（多源通用） */
export interface SyncRequestBody {
  repoSource: string
  encryptionKey?: string
  syncFormatVersion?: number
  syncUseChunkedManifest?: boolean
  syncHashAlgorithm?: string
  syncChunkSize?: number
  syncCompressChunks?: boolean
  syncLocalPath?: string
  syncGitUrl?: string
  syncGitBranch?: string
  syncGitPath?: string
  syncGitUsername?: string
  syncGitPassword?: string
  syncGitSshKey?: string
  syncWebdavEndpoint?: string
  syncWebdavPath?: string
  syncWebdavUsername?: string
  syncWebdavPassword?: string
  syncS3Style?: string
  syncS3Endpoint?: string
  syncS3Path?: string
  syncS3Region?: string
  syncS3Bucket?: string
  syncS3AccessKey?: string
  syncS3SecretKey?: string
  syncTlsVerify?: boolean
}
