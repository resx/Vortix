/* ── JsonlStore：JSONL 追加存储（命令历史/连接日志） ── */

import fs from 'fs'
import path from 'path'

export interface JsonlRecord {
  id: number
  [key: string]: unknown
}

export class JsonlStore<T extends JsonlRecord> {
  private filePath: string
  private cache: T[] = []
  private loaded = false
  private nextId = 1
  private maxRecords: number

  constructor(filePath: string, maxRecords = 5000) {
    this.filePath = filePath
    this.maxRecords = maxRecords
  }

  private ensureDir(): void {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  /** 从文件加载到内存缓存 */
  load(): void {
    this.cache = []
    this.nextId = 1
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8')
        const lines = content.trim().split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const record = JSON.parse(line) as T
            this.cache.push(record)
            if (record.id >= this.nextId) this.nextId = record.id + 1
          } catch { /* 跳过损坏行 */ }
        }
      }
    } catch { /* 文件不存在或损坏 */ }
    this.loaded = true
  }

  /** 追加一条记录 */
  append(record: Omit<T, 'id'>): T {
    if (!this.loaded) this.load()
    this.ensureDir()
    const full = { ...record, id: this.nextId++ } as T
    this.cache.push(full)
    fs.appendFileSync(this.filePath, JSON.stringify(full) + '\n', 'utf8')
    return full
  }

  /** 按条件查询（返回最新的 limit 条） */
  find(predicate: (item: T) => boolean, limit = 100): T[] {
    if (!this.loaded) this.load()
    const matched: T[] = []
    // 从后往前遍历（最新的在后面）
    for (let i = this.cache.length - 1; i >= 0 && matched.length < limit; i--) {
      if (predicate(this.cache[i])) matched.push(this.cache[i])
    }
    return matched
  }

  /** 查询所有记录（最新的 limit 条） */
  findRecent(limit = 100): T[] {
    if (!this.loaded) this.load()
    return this.cache.slice(-limit).reverse()
  }

  /** 按条件删除 */
  removeWhere(predicate: (item: T) => boolean): number {
    if (!this.loaded) this.load()
    const before = this.cache.length
    this.cache = this.cache.filter((item) => !predicate(item))
    const removed = before - this.cache.length
    if (removed > 0) this.rewrite()
    return removed
  }

  /** 清空所有数据 */
  clear(): void {
    this.cache = []
    this.nextId = 1
    this.ensureDir()
    fs.writeFileSync(this.filePath, '', 'utf8')
    this.loaded = true
  }

  /** 清理旧数据，保留最近 maxRecords 条 */
  cleanup(): number {
    if (!this.loaded) this.load()
    if (this.cache.length <= this.maxRecords) return 0
    const removed = this.cache.length - this.maxRecords
    this.cache = this.cache.slice(-this.maxRecords)
    this.rewrite()
    return removed
  }

  /** 重写整个文件 */
  private rewrite(): void {
    this.ensureDir()
    const tmp = this.filePath + '.tmp'
    const content = this.cache.map((r) => JSON.stringify(r)).join('\n') + (this.cache.length ? '\n' : '')
    fs.writeFileSync(tmp, content, 'utf8')
    fs.renameSync(tmp, this.filePath)
  }
}
