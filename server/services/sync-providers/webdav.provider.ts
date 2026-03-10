/* ── WebDAV 同步 Provider ── */

import { createClient, type WebDAVClient } from 'webdav'
import path from 'path'
import type { SyncProvider, SyncFileInfo, WebdavProviderConfig } from './types.js'

const SYNC_FILENAME = 'vortix-sync.json'
const LEGACY_FILENAME = 'vortix-sync.dat'

export class WebdavProvider implements SyncProvider {
  private client: WebDAVClient
  private remotePath: string
  private legacyPath: string

  constructor(config: WebdavProviderConfig) {
    if (!config.endpoint) throw new Error('WebDAV Endpoint 不能为空')
    this.client = createClient(config.endpoint, {
      username: config.username,
      password: config.password,
      ...(config.tlsVerify === false && {
        headers: { 'X-TLS-Verify': 'false' },
      }),
    })
    const dir = config.path || 'vortix'
    const base = dir.endsWith('/') ? dir : `${dir}/`
    this.remotePath = `${base}${SYNC_FILENAME}`
    this.legacyPath = `${base}${LEGACY_FILENAME}`
  }

  private async ensureDir(): Promise<void> {
    const dir = path.posix.dirname(this.remotePath)
    try {
      await this.client.createDirectory(dir, { recursive: true })
    } catch { /* 目录已存在 */ }
  }

  async upload(data: Buffer): Promise<void> {
    await this.ensureDir()
    await this.client.putFileContents(this.remotePath, data, { overwrite: true })
    // 清理旧格式文件
    try { await this.client.deleteFile(this.legacyPath) } catch { /* 不存在则忽略 */ }
  }

  async download(): Promise<Buffer> {
    // 优先新格式，fallback 旧格式
    for (const rp of [this.remotePath, this.legacyPath]) {
      try {
        const result = await this.client.getFileContents(rp)
        if (result instanceof Buffer) return result
        if (result instanceof ArrayBuffer) return Buffer.from(result)
        return Buffer.from(result as string, 'binary')
      } catch { /* 继续 */ }
    }
    throw new Error('同步文件不存在')
  }

  async delete(): Promise<void> {
    try { await this.client.deleteFile(this.remotePath) } catch { /* */ }
    try { await this.client.deleteFile(this.legacyPath) } catch { /* */ }
  }

  async status(): Promise<SyncFileInfo> {
    for (const rp of [this.remotePath, this.legacyPath]) {
      try {
        const stat = await this.client.stat(rp)
        const s = stat as { size?: number; lastmod?: string }
        return { exists: true, lastModified: s.lastmod ?? null, size: s.size ?? null }
      } catch { /* 继续 */ }
    }
    return { exists: false, lastModified: null, size: null }
  }

  async test(): Promise<void> {
    await this.ensureDir()
    const dir = this.remotePath.replace(/[^/]+$/, '')
    const testPath = `${dir}.vortix-test`
    await this.client.putFileContents(testPath, Buffer.from('ok'), { overwrite: true })
    try { await this.client.deleteFile(testPath) } catch { /* 清理失败不影响结果 */ }
  }
}
