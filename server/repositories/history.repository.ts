/* ── 命令历史 Repository ── */

import { getDb } from '../db/database.js'
import type { CommandHistory } from '../types/index.js'

export function findByConnection(connectionId: string, limit = 100): CommandHistory[] {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM command_history WHERE connection_id = ? ORDER BY executed_at DESC LIMIT ?'
  ).all(connectionId, limit) as CommandHistory[]
}

export function create(connectionId: string, command: string): CommandHistory {
  const db = getDb()
  const now = new Date().toISOString()
  const result = db.prepare(
    'INSERT INTO command_history (connection_id, command, executed_at) VALUES (?, ?, ?)'
  ).run(connectionId, command, now)
  return {
    id: Number(result.lastInsertRowid),
    connection_id: connectionId,
    command,
    executed_at: now,
  }
}

export function removeByConnection(connectionId: string): number {
  const db = getDb()
  const result = db.prepare('DELETE FROM command_history WHERE connection_id = ?').run(connectionId)
  return result.changes
}
