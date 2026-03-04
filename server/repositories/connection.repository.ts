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
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
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

export function create(dto: CreateConnectionDto, encryptedPassword?: string | null, encryptedPrivateKey?: string | null): Connection {
  const db = getDb()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO connections (id, folder_id, name, protocol, host, port, username, auth_method, encrypted_password, encrypted_private_key, sort_order, remark, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
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
): Connection | undefined {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM connections WHERE id = ?').get(id) as ConnectionRow | undefined
  if (!existing) return undefined

  const now = new Date().toISOString()

  db.prepare(`
    UPDATE connections SET
      folder_id = ?, name = ?, protocol = ?, host = ?, port = ?, username = ?,
      auth_method = ?, encrypted_password = ?, encrypted_private_key = ?,
      remark = ?, updated_at = ?
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
