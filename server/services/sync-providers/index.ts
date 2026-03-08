/* ── 同步 Provider 工厂 ── */

import type { SyncProvider, ProviderConfig } from './types.js'
import { LocalProvider } from './local.provider.js'
import { GitProvider } from './git.provider.js'
import { WebdavProvider } from './webdav.provider.js'
import { S3Provider } from './s3.provider.js'

export { type SyncProvider, type ProviderConfig, type RepoSource } from './types.js'
export type { SyncFileInfo } from './types.js'

/** 根据配置创建对应的同步 Provider */
export function createSyncProvider(config: ProviderConfig): SyncProvider {
  switch (config.type) {
    case 'local':
      return new LocalProvider(config)
    case 'git':
      return new GitProvider(config)
    case 'webdav':
      return new WebdavProvider(config)
    case 's3':
      return new S3Provider(config)
    default:
      throw new Error(`不支持的同步源类型: ${(config as { type: string }).type}`)
  }
}
