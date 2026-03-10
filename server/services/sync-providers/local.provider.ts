/* ── 本地文件同步 Provider ── */

import fs from 'fs'
import path from 'path'
import type { SyncProvider, SyncFileInfo, LocalProviderConfig } from './types.js'

const SYNC_FILENAME = 'vortix-sync.json'
const LEGACY_FILENAME = 'vortix-sync.dat'

export class LocalProvider implements SyncProvider {
  private filePath: string
  private legacyPath: string

  constructor(config: LocalProviderConfig) {
    if (!config.path) throw new Error('本地同步路径不能为空')
    this.filePath = path.join(config.path, SYNC_FILENAME)
    this.legacyPath = path.join(config.path, LEGACY_FILENAME)
  }

  async upload(data: Buffer): Promise<void> {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(this.filePath, data)
    // 清理旧格式文件
    if (fs.existsSync(this.legacyPath)) {
      try { fs.unlinkSync(this.legacyPath) } catch { /* 静默 */ }
    }
  }

  async download(): Promise<Buffer> {
    // 优先读取新格式，fallback 到旧格式
    if (fs.existsSync(this.filePath)) {
      return fs.readFileSync(this.filePath)
    }
    if (fs.existsSync(this.legacyPath)) {
      return fs.readFileSync(this.legacyPath)
    }
    throw new Error('同步文件不存在')
  }

  async delete(): Promise<void> {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath)
    if (fs.existsSync(this.legacyPath)) fs.unlinkSync(this.legacyPath)
  }

  async status(): Promise<SyncFileInfo> {
    // 优先检查新格式
    for (const fp of [this.filePath, this.legacyPath]) {
      try {
        const stat = fs.statSync(fp)
        return { exists: true, lastModified: stat.mtime.toISOString(), size: stat.size }
      } catch { /* 继续 */ }
    }
    return { exists: false, lastModified: null, size: null }
  }

  async test(): Promise<void> {
    const testPath = path.join(path.dirname(this.filePath), '.vortix-test')
    const dir = path.dirname(testPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(testPath, 'ok')
    fs.unlinkSync(testPath)
  }
}
