/* ── SQLite → JSON 一次性数据迁移 ── */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const CONFIG_DIR = path.join(DATA_DIR, 'config')
const LOGS_DIR = path.join(DATA_DIR, 'logs')
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'vortix.db')
const ENCRYPTION_KEY_PATH = path.join(DATA_DIR, 'encryption.key')

/** 检测是否需要迁移（旧 .db 存在且新 config 目录不存在） */
export function needsMigration(): boolean {
  return fs.existsSync(DB_PATH) && !fs.existsSync(path.join(CONFIG_DIR, 'folders.json'))
}

/** 执行 SQLite → JSON 迁移 */
export async function migrateToJson(): Promise<void> {
  if (!needsMigration()) return

  console.log('[Vortix Migration] 检测到旧版 SQLite 数据库，开始迁移到 JSON 存储...')

  // 动态导入 better-sqlite3（迁移后不再需要）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Database: any
  try {
    const mod = await import('better-sqlite3' as string)
    Database = mod.default
  } catch {
    console.log('[Vortix Migration] better-sqlite3 不可用，跳过迁移')
    return
  }

  const db = new Database(DB_PATH, { readonly: true })

  try {
    // 确保目录存在
    for (const dir of [CONFIG_DIR, LOGS_DIR]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    }

    // 1. 迁移 encryption_meta → encryption.key
    try {
      const row = db.prepare("SELECT value FROM encryption_meta WHERE key = 'encryption_key'").get() as { value: string } | undefined
      if (row) {
        fs.writeFileSync(ENCRYPTION_KEY_PATH, row.value, 'utf8')
        console.log('[Vortix Migration] encryption.key 已迁移')
      }
    } catch { /* 表可能不存在 */ }

    // 2. 迁移 folders
    try {
      const folders = db.prepare('SELECT * FROM folders ORDER BY sort_order, name').all()
      writeJson(path.join(CONFIG_DIR, 'folders.json'), folders)
      console.log(`[Vortix Migration] folders: ${folders.length} 条`)
    } catch { writeJson(path.join(CONFIG_DIR, 'folders.json'), []) }

    // 3. 迁移 connections
    try {
      const connections = db.prepare('SELECT * FROM connections ORDER BY sort_order, name').all()
      writeJson(path.join(CONFIG_DIR, 'connections.json'), connections)
      console.log(`[Vortix Migration] connections: ${connections.length} 条`)
    } catch { writeJson(path.join(CONFIG_DIR, 'connections.json'), []) }

    // 4. 迁移 settings
    try {
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
      const settings: Record<string, unknown> = {}
      for (const row of rows) {
        try { settings[row.key] = JSON.parse(row.value) } catch { settings[row.key] = row.value }
      }
      writeJson(path.join(CONFIG_DIR, 'settings.json'), settings)
      console.log(`[Vortix Migration] settings: ${rows.length} 项`)
    } catch { writeJson(path.join(CONFIG_DIR, 'settings.json'), {}) }

    // 5. 迁移 shortcuts
    try {
      const shortcuts = db.prepare('SELECT * FROM shortcuts ORDER BY sort_order, name').all()
      writeJson(path.join(CONFIG_DIR, 'shortcuts.json'), shortcuts)
      console.log(`[Vortix Migration] shortcuts: ${shortcuts.length} 条`)
    } catch { writeJson(path.join(CONFIG_DIR, 'shortcuts.json'), []) }

    // 6. 迁移 ssh_keys
    try {
      const keys = db.prepare('SELECT * FROM ssh_keys ORDER BY created_at DESC').all()
      writeJson(path.join(CONFIG_DIR, 'ssh-keys.json'), keys)
      console.log(`[Vortix Migration] ssh_keys: ${keys.length} 条`)
    } catch { writeJson(path.join(CONFIG_DIR, 'ssh-keys.json'), []) }

    // 7. 迁移 command_history → JSONL
    try {
      const history = db.prepare('SELECT * FROM command_history ORDER BY id').all() as { id: number; connection_id: string; command: string; executed_at: string }[]
      const lines = history.map((r) => JSON.stringify(r)).join('\n') + (history.length ? '\n' : '')
      fs.writeFileSync(path.join(LOGS_DIR, 'command-history.jsonl'), lines, 'utf8')
      console.log(`[Vortix Migration] command_history: ${history.length} 条`)
    } catch { fs.writeFileSync(path.join(LOGS_DIR, 'command-history.jsonl'), '', 'utf8') }

    // 8. 迁移 connection_logs → JSONL
    try {
      const logs = db.prepare('SELECT * FROM connection_logs ORDER BY id').all() as { id: number; connection_id: string; event: string; message: string; duration_ms: number | null; created_at: string }[]
      const lines = logs.map((r) => JSON.stringify(r)).join('\n') + (logs.length ? '\n' : '')
      fs.writeFileSync(path.join(LOGS_DIR, 'connection-logs.jsonl'), lines, 'utf8')
      console.log(`[Vortix Migration] connection_logs: ${logs.length} 条`)
    } catch { fs.writeFileSync(path.join(LOGS_DIR, 'connection-logs.jsonl'), '', 'utf8') }

    console.log('[Vortix Migration] 迁移完成，旧数据库文件已保留作为备份')
  } finally {
    db.close()
  }
}

function writeJson(filePath: string, data: unknown): void {
  const tmp = filePath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, filePath)
}
