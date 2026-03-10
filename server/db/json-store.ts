/* ── JsonStore：通用 JSON 文件存储（内存缓存 + 原子写入） ── */

import fs from 'fs'
import path from 'path'

export class JsonStore<T extends { id: string }> {
  private items: T[] = []
  private filePath: string
  private loaded = false

  constructor(filePath: string) {
    this.filePath = filePath
  }

  /** 确保目录存在 */
  private ensureDir(): void {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  /** 从文件加载到内存 */
  load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        this.items = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
      }
    } catch {
      this.items = []
    }
    this.loaded = true
  }

  /** 原子写入文件 */
  private flush(): void {
    this.ensureDir()
    const tmp = this.filePath + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(this.items, null, 2), 'utf8')
    fs.renameSync(tmp, this.filePath)
  }

  /** 获取所有项 */
  findAll(): T[] {
    if (!this.loaded) this.load()
    return [...this.items]
  }

  /** 按 ID 查找 */
  findById(id: string): T | undefined {
    if (!this.loaded) this.load()
    return this.items.find((item) => item.id === id)
  }

  /** 插入一项 */
  insert(item: T): void {
    if (!this.loaded) this.load()
    this.items.push(item)
    this.flush()
  }

  /** 更新一项（按 ID 替换） */
  update(id: string, updater: (item: T) => T): T | undefined {
    if (!this.loaded) this.load()
    const idx = this.items.findIndex((item) => item.id === id)
    if (idx === -1) return undefined
    this.items[idx] = updater(this.items[idx])
    this.flush()
    return this.items[idx]
  }

  /** 删除一项 */
  remove(id: string): boolean {
    if (!this.loaded) this.load()
    const before = this.items.length
    this.items = this.items.filter((item) => item.id !== id)
    if (this.items.length < before) {
      this.flush()
      return true
    }
    return false
  }

  /** 清空所有数据 */
  clear(): void {
    this.items = []
    this.flush()
  }

  /** 批量替换所有数据 */
  replaceAll(items: T[]): void {
    this.items = [...items]
    this.loaded = true
    this.flush()
  }

  /** 获取数量 */
  count(): number {
    if (!this.loaded) this.load()
    return this.items.length
  }
}

/**
 * SettingsJsonStore：设置键值对存储（单对象 JSON）
 */
export class SettingsJsonStore {
  private data: Record<string, unknown> = {}
  private filePath: string
  private loaded = false

  constructor(filePath: string) {
    this.filePath = filePath
  }

  private ensureDir(): void {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
      }
    } catch {
      this.data = {}
    }
    this.loaded = true
  }

  private flush(): void {
    this.ensureDir()
    const tmp = this.filePath + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
    fs.renameSync(tmp, this.filePath)
  }

  getAll(): Record<string, unknown> {
    if (!this.loaded) this.load()
    return { ...this.data }
  }

  get(key: string): unknown | undefined {
    if (!this.loaded) this.load()
    return this.data[key]
  }

  setMany(settings: Record<string, unknown>): void {
    if (!this.loaded) this.load()
    Object.assign(this.data, settings)
    this.flush()
  }

  clear(): void {
    this.data = {}
    this.flush()
  }

  replaceAll(data: Record<string, unknown>): void {
    this.data = { ...data }
    this.loaded = true
    this.flush()
  }
}
