/* ── 连接日志 Repository ── */

import { getDb } from '../db/database.js'
import type { ConnectionLog, RecentConnection } from '../types/index.js'

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

/** 查询最近连接（去重，按最后连接时间倒序） */
export function findRecentConnections(limit = 15): RecentConnection[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      c.id, c.name, c.host, c.port, c.username, c.protocol, c.color_tag,
      f.name AS folder_name,
      MAX(cl.created_at) AS last_connected_at
    FROM connection_logs cl
    JOIN connections c ON c.id = cl.connection_id
    LEFT JOIN folders f ON f.id = c.folder_id
    WHERE cl.event = 'connect'
    GROUP BY c.id
    ORDER BY last_connected_at DESC
    LIMIT ?
  `).all(limit) as RecentConnection[]
}

/** 清除孤立数据（已删除连接的历史和日志） */
export function cleanupOrphanData(): number {
  const db = getDb()
  let total = 0
  const r1 = db.prepare(
    'DELETE FROM connection_logs WHERE connection_id NOT IN (SELECT id FROM connections)'
  ).run()
  total += r1.changes
  const r2 = db.prepare(
    'DELETE FROM command_history WHERE connection_id NOT IN (SELECT id FROM connections)'
  ).run()
  total += r2.changes
  return total
}
