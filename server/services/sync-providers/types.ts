/* ── 同步 Provider 接口 + 配置类型 ── */

/** 同步文件元信息 */
export interface SyncFileInfo {
  exists: boolean
  lastModified: string | null
  size: number | null
}

/** Provider 统一接口 */
export interface SyncProvider {
  /** 上传同步数据 */
  upload(data: Buffer): Promise<void>
  /** 下载同步数据 */
  download(): Promise<Buffer>
  /** 删除远端同步文件 */
  delete(): Promise<void>
  /** 查询同步文件状态 */
  status(): Promise<SyncFileInfo>
  /** 连通性测试：上传测试文件 → 验证 → 删除，不影响真实同步数据 */
  test(): Promise<void>
}

export type RepoSource = 'local' | 'git' | 'webdav' | 's3'

/* ── 各源配置 ── */

export interface LocalProviderConfig {
  type: 'local'
  path: string
}

export interface GitProviderConfig {
  type: 'git'
  url: string
  branch: string
  path?: string
  username?: string
  password?: string
  sshKey?: string
  tlsVerify: boolean
}

export interface WebdavProviderConfig {
  type: 'webdav'
  endpoint: string
  path: string
  username: string
  password: string
  tlsVerify: boolean
}

export interface S3ProviderConfig {
  type: 's3'
  endpoint: string
  path: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  style: 'virtual-hosted' | 'path'
  tlsVerify: boolean
}

export type ProviderConfig =
  | LocalProviderConfig
  | GitProviderConfig
  | WebdavProviderConfig
  | S3ProviderConfig
