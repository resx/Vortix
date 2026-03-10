/* ── 连接 Repository ── */

import crypto from 'crypto'
import { connectionStore } from '../db/stores.js'
import { markDirty } from '../services/auto-sync.service.js'
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
  let rows = connectionStore.findAll()
  if (folderId) rows = rows.filter((r) => r.folder_id === folderId)
  return rows.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)).map(toConnection)
}

export function findById(id: string): Connection | undefined {
  const row = connectionStore.findById(id)
  return row ? toConnection(row) : undefined
}

/** 获取原始行（包含加密字段，仅内部使用） */
export function findRawById(id: string): ConnectionRow | undefined {
  return connectionStore.findById(id)
}

/** 获取所有原始行（含加密字段，仅同步服务使用） */
export function findAllRaw(): ConnectionRow[] {
  return connectionStore.findAll()
}

export function create(dto: CreateConnectionDto, encryptedPassword?: string | null, encryptedPrivateKey?: string | null, encryptedProxyPassword?: string | null): Connection {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const row: ConnectionRow = {
    id,
    folder_id: dto.folder_id ?? null,
    name: dto.name,
    protocol: dto.protocol ?? 'ssh',
    host: dto.host,
    port: dto.port ?? 22,
    username: dto.username,
    auth_method: dto.auth_method ?? 'password',
    encrypted_password: encryptedPassword ?? null,
    encrypted_private_key: encryptedPrivateKey ?? null,
    sort_order: 0,
    remark: dto.remark ?? '',
    color_tag: dto.color_tag ?? null,
    environment: dto.environment ?? '无',
    auth_type: dto.auth_type ?? 'password',
    proxy_type: dto.proxy_type ?? '关闭',
    proxy_host: dto.proxy_host ?? '127.0.0.1',
    proxy_port: dto.proxy_port ?? 7890,
    proxy_username: dto.proxy_username ?? '',
    proxy_password: encryptedProxyPassword ?? '',
    proxy_timeout: dto.proxy_timeout ?? 5,
    jump_server_id: dto.jump_server_id ?? null,
    tunnels: dto.tunnels ?? '[]',
    env_vars: dto.env_vars ?? '[]',
    advanced: dto.advanced ?? '{}',
    created_at: now,
    updated_at: now,
  }
  connectionStore.insert(row)
  markDirty()
  return toConnection(row)
}

export function update(
  id: string,
  dto: UpdateConnectionDto,
  encryptedPassword?: string | null,
  encryptedPrivateKey?: string | null,
  encryptedProxyPassword?: string | null,
): Connection | undefined {
  const result = connectionStore.update(id, (existing) => ({
    ...existing,
    folder_id: dto.folder_id !== undefined ? dto.folder_id : existing.folder_id,
    name: dto.name ?? existing.name,
    protocol: dto.protocol ?? existing.protocol,
    host: dto.host ?? existing.host,
    port: dto.port ?? existing.port,
    username: dto.username ?? existing.username,
    auth_method: dto.auth_method ?? existing.auth_method,
    encrypted_password: encryptedPassword !== undefined ? encryptedPassword : existing.encrypted_password,
    encrypted_private_key: encryptedPrivateKey !== undefined ? encryptedPrivateKey : existing.encrypted_private_key,
    remark: dto.remark !== undefined ? dto.remark : existing.remark,
    color_tag: dto.color_tag !== undefined ? dto.color_tag : existing.color_tag,
    environment: dto.environment !== undefined ? dto.environment : existing.environment,
    auth_type: dto.auth_type !== undefined ? dto.auth_type : existing.auth_type,
    proxy_type: dto.proxy_type !== undefined ? dto.proxy_type : existing.proxy_type,
    proxy_host: dto.proxy_host !== undefined ? dto.proxy_host : existing.proxy_host,
    proxy_port: dto.proxy_port !== undefined ? dto.proxy_port : existing.proxy_port,
    proxy_username: dto.proxy_username !== undefined ? dto.proxy_username : existing.proxy_username,
    proxy_password: encryptedProxyPassword !== undefined ? (encryptedProxyPassword ?? '') : existing.proxy_password,
    proxy_timeout: dto.proxy_timeout !== undefined ? dto.proxy_timeout : existing.proxy_timeout,
    jump_server_id: dto.jump_server_id !== undefined ? dto.jump_server_id : existing.jump_server_id,
    tunnels: dto.tunnels !== undefined ? dto.tunnels : existing.tunnels,
    env_vars: dto.env_vars !== undefined ? dto.env_vars : existing.env_vars,
    advanced: dto.advanced !== undefined ? dto.advanced : existing.advanced,
    updated_at: new Date().toISOString(),
  }))
  if (result) {
    markDirty()
    return toConnection(result)
  }
  return undefined
}

export function remove(id: string): boolean {
  const ok = connectionStore.remove(id)
  if (ok) markDirty()
  return ok
}
