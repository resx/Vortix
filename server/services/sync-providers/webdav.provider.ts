/* ── WebDAV 同步 Provider ── */

import { createClient, type WebDAVClient } from 'webdav'
import path from 'path'
import type { SyncProvider, SyncFileInfo, WebdavProviderConfig } from './types.js'

const SYNC_FILENAME = 'vortix-sync.dat'

export class WebdavProvider implements SyncProvider {
  private client: WebDAVClient
  private remotePath: string

  constructor(config: WebdavProviderConfig) {
    if (!config.endpoint) throw new Error('WebDAV Endpoint 不能为空')
    this.client = createClient(config.endpoint, {
      username: config.username,
      password: config.password,
      // TLS 验证由 Node.js 环境变量控制
      ...(config.tlsVerify === false && {
        headers: { 'X-TLS-Verify': 'false' },
      }),
    })
    // 远端文件路径
    const dir = config.path || 'vortix'
    this.remotePath = dir.endsWith('/') ? `${dir}${SYNC_FILENAME}` : `${dir}/${SYNC_FILENAME}`
  }

  /** 确保远端目录存在 */
  private async ensureDir(): Promise<void> {
    const dir = path.posix.dirname(this.remotePath)
    try {
      await this.client.createDirectory(dir, { recursive: true })
    } catch {
      // 目录已存在，忽略
    }
  }

  async upload(data: Buffer): Promise<void> {
    await this.ensureDir()
    await this.client.putFileContents(this.remotePath, data, { overwrite: true })
  }

  async download(): Promise<Buffer> {
    const result = await this.client.getFileContents(this.remotePath)
    if (result instanceof Buffer) return result
    if (result instanceof ArrayBuffer) return Buffer.from(result)
    // string 类型
    return Buffer.from(result as string, 'binary')
  }

  async delete(): Promise<void> {
    try {
      await this.client.deleteFile(this.remotePath)
    } catch {
      // 文件不存在，忽略
    }
  }

  async status(): Promise<SyncFileInfo> {
    try {
      const stat = await this.client.stat(this.remotePath)
      const s = stat as { size?: number; lastmod?: string }
      return {
        exists: true,
        lastModified: s.lastmod ?? null,
        size: s.size ?? null,
      }
    } catch {
      return { exists: false, lastModified: null, size: null }
    }
  }
}
