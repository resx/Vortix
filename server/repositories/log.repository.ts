/* ── 连接日志 Repository ── */

import { getDb } from '../db/database.js'
import type { ConnectionLog } from '../types/index.js'

export function findByConnection(connectionId: string, limit = 50): ConnectionLog[] {
  const db = getDb()
  return db.prepare(
    'SELECT * FROM connection_logs WHERE connection_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(connectionId, limit) as ConnectionLog[]
}

export function create(
  connectionId: string,
  event: ConnectionLog['event'],
  message = '',
  durationMs: number | null = null,
): ConnectionLog {
  const db = getDb()
  const now = new Date().toISOString()
  const result = db.prepare(
    'INSERT INTO connection_logs (connection_id, event, message, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(connectionId, event, message, durationMs, now)
  return {
    id: Number(result.lastInsertRowid),
    connection_id: connectionId,
    event,
    message,
    duration_ms: durationMs,
    created_at: now,
  }
}
