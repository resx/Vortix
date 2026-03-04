/* ── 设置 Repository ── */

import { getDb } from '../db/database.js'

/** 获取所有设置 */
export function getAll(): Record<string, unknown> {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const result: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value)
    } catch {
      result[row.key] = row.value
    }
  }
  return result
}

/** 获取单个设置 */
export function get(key: string): unknown | undefined {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  if (!row) return undefined
  try {
    return JSON.parse(row.value)
  } catch {
    return row.value
  }
}

/** 批量设置（upsert） */
export function setMany(settings: Record<string, unknown>): void {
  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)

  const transaction = db.transaction((entries: [string, unknown][]) => {
    for (const [key, value] of entries) {
      upsert.run(key, JSON.stringify(value))
    }
  })

  transaction(Object.entries(settings))
}

/** 重置所有设置 */
export function resetAll(): void {
  const db = getDb()
  db.prepare('DELETE FROM settings').run()
}
