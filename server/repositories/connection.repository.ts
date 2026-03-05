/* ── 连接 Repository ── */

import crypto from 'crypto'
import { getDb } from '../db/database.js'
import type { Connection, ConnectionRow, CreateConnectionDto, UpdateConnectionDto } from '../types/index.js'

/** 将数据库行转为 API 安全响应（不含明文密码） */
function toConnection(row: ConnectionRow): Connection {
  return {
    id: row.id,
    folder_id: row.folder_id,
    name: row.name,
    protocol: row.protocol as Connection['protocol'],
    host: row.host,
    port: row.port,
    username: row.username,
    auth_method: row.auth_method as Connection['auth_method'],
    has_password: !!row.encrypted_password,
    has_private_key: !!row.encrypted_private_key,
    sort_order: row.sort_order,
    remark: row.remark,
    color_tag: row.color_tag,
    environment: row.environment ?? '无',
    auth_type: row.auth_type ?? 'password',
    proxy_type: row.proxy_type ?? '关闭',
    proxy_host: row.proxy_host ?? '127.0.0.1',
    proxy_port: row.proxy_port ?? 7890,
    proxy_username: row.proxy_username ?? '',
    proxy_timeout: row.proxy_timeout ?? 5,
    jump_server_id: row.jump_server_id,
    tunnels: safeJsonParse(row.tunnels, []),
    env_vars: safeJsonParse(row.env_vars, []),
    advanced: safeJsonParse(row.advanced, {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

export function findAll(folderId?: string): Connection[] {
  const db = getDb()
  let rows: ConnectionRow[]
  if (folderId) {
    rows = db.prepare('SELECT * FROM connections WHERE folder_id = ? ORDER BY sort_order, name').all(folderId) as ConnectionRow[]
  } else {
    rows = db.prepare('SELECT * FROM connections ORDER BY sort_order, name').all() as ConnectionRow[]
  }
  return rows.map(toConnection)
}

export function findById(id: string): Connection | undefined {
  const db = getDb()
  const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as ConnectionRow | undefined
  return row ? toConnection(row) : undefined
}

/** 获取原始行（包含加密字段，仅内部使用） */
export function findRawById(id: string): ConnectionRow | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as ConnectionRow | undefined
}

export function create(dto: CreateConnectionDto, encryptedPassword?: string | null, encryptedPrivateKey?: string | null, encryptedProxyPassword?: string | null): Connection {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO connections (
      id, folder_id, name, protocol, host, port, username, auth_method,
      encrypted_password, encrypted_private_key, sort_order, remark,
      color_tag, environment, auth_type, proxy_type, proxy_host, proxy_port,
      proxy_username, proxy_password, proxy_timeout, jump_server_id,
      tunnels, env_vars, advanced, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    dto.folder_id ?? null,
    dto.name,
    dto.protocol ?? 'ssh',
    dto.host,
    dto.port ?? 22,
    dto.username,
    dto.auth_method ?? 'password',
    encryptedPassword ?? null,
    encryptedPrivateKey ?? null,
    dto.remark ?? '',
    dto.color_tag ?? null,
    dto.environment ?? '无',
    dto.auth_type ?? 'password',
    dto.proxy_type ?? '关闭',
    dto.proxy_host ?? '127.0.0.1',
    dto.proxy_port ?? 7890,
    dto.proxy_username ?? '',
    encryptedProxyPassword ?? null,
    dto.proxy_timeout ?? 5,
    dto.jump_server_id ?? null,
    dto.tunnels ?? '[]',
    dto.env_vars ?? '[]',
    dto.advanced ?? '{}',
    now,
    now,
  )

  return findById(id)!
}

export function update(
  id: string,
  dto: UpdateConnectionDto,
  encryptedPassword?: string | null,
  encryptedPrivateKey?: string | null,
  encryptedProxyPassword?: string | null,
): Connection | undefined {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as ConnectionRow | undefined
  if (!existing) return undefined

  const now = new Date().toISOString()

  db.prepare(`
    UPDATE connections SET
      folder_id = ?, name = ?, protocol = ?, host = ?, port = ?, username = ?,
      auth_method = ?, encrypted_password = ?, encrypted_private_key = ?,
      remark = ?, color_tag = ?, environment = ?, auth_type = ?,
      proxy_type = ?, proxy_host = ?, proxy_port = ?, proxy_username = ?,
      proxy_password = ?, proxy_timeout = ?, jump_server_id = ?,
      tunnels = ?, env_vars = ?, advanced = ?, updated_at = ?
    WHERE id = ?
  `).run(
    dto.folder_id !== undefined ? dto.folder_id : existing.folder_id,
    dto.name ?? existing.name,
    dto.protocol ?? existing.protocol,
    dto.host ?? existing.host,
    dto.port ?? existing.port,
    dto.username ?? existing.username,
    dto.auth_method ?? existing.auth_method,
    encryptedPassword !== undefined ? encryptedPassword : existing.encrypted_password,
    encryptedPrivateKey !== undefined ? encryptedPrivateKey : existing.encrypted_private_key,
    dto.remark !== undefined ? dto.remark : existing.remark,
    dto.color_tag !== undefined ? dto.color_tag : existing.color_tag,
    dto.environment !== undefined ? dto.environment : existing.environment,
    dto.auth_type !== undefined ? dto.auth_type : existing.auth_type,
    dto.proxy_type !== undefined ? dto.proxy_type : existing.proxy_type,
    dto.proxy_host !== undefined ? dto.proxy_host : existing.proxy_host,
    dto.proxy_port !== undefined ? dto.proxy_port : existing.proxy_port,
    dto.proxy_username !== undefined ? dto.proxy_username : existing.proxy_username,
    encryptedProxyPassword !== undefined ? encryptedProxyPassword : existing.proxy_password,
    dto.proxy_timeout !== undefined ? dto.proxy_timeout : existing.proxy_timeout,
    dto.jump_server_id !== undefined ? dto.jump_server_id : existing.jump_server_id,
    dto.tunnels !== undefined ? dto.tunnels : existing.tunnels,
    dto.env_vars !== undefined ? dto.env_vars : existing.env_vars,
    dto.advanced !== undefined ? dto.advanced : existing.advanced,
    now,
    id,
  )

  return findById(id)
}

export function remove(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM connections WHERE id = ?').run(id)
  return result.changes > 0
}
