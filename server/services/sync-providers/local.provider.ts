/* ── 本地文件同步 Provider ── */

import fs from 'fs'
import path from 'path'
import type { SyncProvider, SyncFileInfo, LocalProviderConfig } from './types.js'

const SYNC_FILENAME = 'vortix-sync.dat'

export class LocalProvider implements SyncProvider {
  private filePath: string

  constructor(config: LocalProviderConfig) {
    if (!config.path) throw new Error('本地同步路径不能为空')
    this.filePath = path.join(config.path, SYNC_FILENAME)
  }

  async upload(data: Buffer): Promise<void> {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(this.filePath, data)
  }

  async download(): Promise<Buffer> {
    if (!fs.existsSync(this.filePath)) {
      throw new Error('同步文件不存在')
    }
    return fs.readFileSync(this.filePath)
  }

  async delete(): Promise<void> {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath)
    }
  }

  async status(): Promise<SyncFileInfo> {
    try {
      const stat = fs.statSync(this.filePath)
      return {
        exists: true,
        lastModified: stat.mtime.toISOString(),
        size: stat.size,
      }
    } catch {
      return { exists: false, lastModified: null, size: null }
    }
  }
}
