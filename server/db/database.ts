/* ── SQLite 连接单例 (WAL 模式) ── */

import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 数据库文件路径：优先使用环境变量，否则默认 ./data/vortix.db
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../data/vortix.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    // 启用 WAL 模式提升并发性能
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
