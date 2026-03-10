/* ── 连接日志 Repository ── */

import { logStore, connectionStore, folderStore, historyStore } from '../db/stores.js'
import type { ConnectionLog, RecentConnection } from '../types/index.js'

export function findByConnection(connectionId: string, limit = 50): ConnectionLog[] {
  return logStore.find((r) => r.connection_id === connectionId, limit)
}

export function create(
  connectionId: string,
  event: ConnectionLog['event'],
  message = '',
  durationMs: number | null = null,
): ConnectionLog {
  return logStore.append({
    connection_id: connectionId,
    event,
    message,
    duration_ms: durationMs,
    created_at: new Date().toISOString(),
  } as Omit<ConnectionLog, 'id'>)
}

/** 查询最近连接（应用层关联，去重，按最后连接时间倒序） */
export function findRecentConnections(limit = 15): RecentConnection[] {
  // 从日志中找最近的 connect 事件
  const connectLogs = logStore.find((r) => r.event === 'connect', 500)

  // 按 connection_id 去重，保留最新的
  const latestMap = new Map<string, string>()
  for (const log of connectLogs) {
    if (!latestMap.has(log.connection_id)) {
      latestMap.set(log.connection_id, log.created_at)
    }
  }

  // 关联连接信息和文件夹名
  const connections = connectionStore.findAll()
  const folders = folderStore.findAll()
  const folderMap = new Map(folders.map((f) => [f.id, f.name]))

  const results: RecentConnection[] = []
  for (const [connId, lastAt] of latestMap) {
    const conn = connections.find((c) => c.id === connId)
    if (!conn) continue
    results.push({
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      protocol: conn.protocol,
      color_tag: conn.color_tag,
      folder_name: conn.folder_id ? (folderMap.get(conn.folder_id) ?? null) : null,
      last_connected_at: lastAt,
    })
    if (results.length >= limit) break
  }

  return results
}

/** 清除孤立数据（已删除连接的历史和日志） */
export function cleanupOrphanData(): number {
  const connections = connectionStore.findAll()
  const connIds = new Set(connections.map((c) => c.id))
  let total = logStore.removeWhere((r) => !connIds.has(r.connection_id))
  total += historyStore.removeWhere((r) => !connIds.has(r.connection_id))
  return total
}
