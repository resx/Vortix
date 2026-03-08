/* ── 云同步服务：导出/导入数据（支持可选加密 + Provider） ── */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getDb } from '../db/database.js'
import * as folderRepo from '../repositories/folder.repository.js'
import * as connectionRepo from '../repositories/connection.repository.js'
import * as settingsRepo from '../repositories/settings.repository.js'
import * as shortcutRepo from '../repositories/shortcut.repository.js'
import * as cryptoService from './crypto.service.js'
import type { SyncProvider } from './sync-providers/types.js'
import type { SyncPayload, SyncConnection, ImportResult, ConnectionRow } from '../types/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../data/vortix.db')

// 同步文件格式常量
const MAGIC = Buffer.from('VTXS')          // 4 bytes
const VERSION_ENCRYPTED = 1                 // uint16 — 加密格式
const VERSION_PLAINTEXT = 2                 // uint16 — 明文格式
const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const TAG_LENGTH = 16

/** 从同步密码派生 AES-256 密钥 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256')
}

/** 将 ConnectionRow 转为 SyncConnection（解密凭据） */
function rowToSyncConnection(row: ConnectionRow): SyncConnection {
  let password: string | null = null
  let privateKey: string | null = null
  let proxyPassword: string | null = null

  try { if (row.encrypted_password) password = cryptoService.decrypt(row.encrypted_password) } catch { /* 解密失败则置空 */ }
  try { if (row.encrypted_private_key) privateKey = cryptoService.decrypt(row.encrypted_private_key) } catch { /* */ }
  try { if (row.proxy_password) proxyPassword = cryptoService.decrypt(row.proxy_password) } catch { /* */ }

  return {
    id: row.id, folder_id: row.folder_id, name: row.name, protocol: row.protocol,
    host: row.host, port: row.port, username: row.username, auth_method: row.auth_method,
    password, private_key: privateKey, sort_order: row.sort_order, remark: row.remark,
    color_tag: row.color_tag, environment: row.environment, auth_type: row.auth_type,
    proxy_type: row.proxy_type, proxy_host: row.proxy_host, proxy_port: row.proxy_port,
    proxy_username: row.proxy_username, proxy_password: proxyPassword,
    proxy_timeout: row.proxy_timeout, jump_server_id: row.jump_server_id,
    tunnels: row.tunnels, env_vars: row.env_vars, advanced: row.advanced,
    created_at: row.created_at, updated_at: row.updated_at,
  }
}

/** 收集全量同步 payload */
function collectPayload(): SyncPayload {
  const folders = folderRepo.findAll()
  const rawConnections = connectionRepo.findAllRaw()
  const settings = settingsRepo.getAll()
  const shortcuts = shortcutRepo.findAll()
  const terminalProfiles = (settings.terminalProfiles as unknown[]) ?? []
  const connections: SyncConnection[] = rawConnections.map(rowToSyncConnection)

  return {
    version: VERSION_ENCRYPTED,
    exportedAt: new Date().toISOString(),
    data: { folders, connections, settings, shortcuts, terminalProfiles },
  }
}

/**
 * 导出同步数据
 * - encryptionKey 为空/undefined → 明文（version=2）
 * - encryptionKey 非空 → AES-256-GCM 加密（version=1）
 */
export function exportData(encryptionKey?: string): Buffer {
  const payload = collectPayload()
  const jsonBuf = Buffer.from(JSON.stringify(payload), 'utf8')

  if (!encryptionKey) {
    // 明文格式: magic(4) + version(2) + json
    const versionBuf = Buffer.alloc(2)
    versionBuf.writeUInt16BE(VERSION_PLAINTEXT)
    return Buffer.concat([MAGIC, versionBuf, jsonBuf])
  }

  // 加密格式: magic(4) + version(2) + salt(16) + iv(12) + tag(16) + ciphertext
  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = deriveKey(encryptionKey, salt)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(jsonBuf), cipher.final()])
  const tag = cipher.getAuthTag()

  const versionBuf = Buffer.alloc(2)
  versionBuf.writeUInt16BE(VERSION_ENCRYPTED)
  return Buffer.concat([MAGIC, versionBuf, salt, iv, tag, encrypted])
}

/**
 * 导入同步数据
 * 根据 version 自动判断加密/明文
 */
export function importData(fileBuffer: Buffer, encryptionKey?: string): ImportResult {
  // 1. 解析 header
  const magic = fileBuffer.subarray(0, 4)
  if (!magic.equals(MAGIC)) throw new Error('无效的同步文件格式')

  const version = fileBuffer.readUInt16BE(4)

  let payload: SyncPayload

  if (version === VERSION_PLAINTEXT) {
    // 明文格式
    const jsonStr = fileBuffer.subarray(6).toString('utf8')
    payload = JSON.parse(jsonStr)
  } else if (version === VERSION_ENCRYPTED) {
    // 加密格式
    if (!encryptionKey) throw new Error('该同步文件已加密，请提供加密密钥')
    const salt = fileBuffer.subarray(6, 6 + SALT_LENGTH)
    const iv = fileBuffer.subarray(22, 22 + IV_LENGTH)
    const tag = fileBuffer.subarray(34, 34 + TAG_LENGTH)
    const encrypted = fileBuffer.subarray(50)

    const key = deriveKey(encryptionKey, salt)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)

    let decrypted: Buffer
    try {
      decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    } catch {
      throw new Error('同步密码错误或文件已损坏')
    }
    payload = JSON.parse(decrypted.toString('utf8'))
  } else {
    throw new Error(`不支持的同步文件版本: ${version}`)
  }

  // 2. 备份当前数据库
  const backupPath = DB_PATH.replace(/\.db$/, `-backup-${Date.now()}.db`)
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, backupPath)
  }

  // 3. 事务内清空并导入
  return applyPayload(payload)
}

/** 将 payload 写入数据库（事务） */
function applyPayload(payload: SyncPayload): ImportResult {
  const db = getDb()
  const result: ImportResult = { folders: 0, connections: 0, settings: 0, shortcuts: 0, profiles: 0 }

  const insertFolder = db.prepare(`
    INSERT INTO folders (id, name, parent_id, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertConnection = db.prepare(`
    INSERT INTO connections (
      id, folder_id, name, protocol, host, port, username, auth_method,
      encrypted_password, encrypted_private_key, sort_order, remark,
      color_tag, environment, auth_type, proxy_type, proxy_host, proxy_port,
      proxy_username, proxy_password, proxy_timeout, jump_server_id,
      tunnels, env_vars, advanced, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertSetting = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
  const insertShortcut = db.prepare(`
    INSERT INTO shortcuts (id, name, command, remark, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  db.transaction(() => {
    db.prepare('DELETE FROM connections').run()
    db.prepare('DELETE FROM folders').run()
    db.prepare('DELETE FROM settings').run()
    db.prepare('DELETE FROM shortcuts').run()

    for (const f of payload.data.folders) {
      insertFolder.run(f.id, f.name, f.parent_id, f.sort_order, f.created_at, f.updated_at)
      result.folders++
    }

    for (const c of payload.data.connections) {
      const encPwd = c.password ? cryptoService.encrypt(c.password) : null
      const encKey = c.private_key ? cryptoService.encrypt(c.private_key) : null
      const encProxy = c.proxy_password ? cryptoService.encrypt(c.proxy_password) : null
      insertConnection.run(
        c.id, c.folder_id, c.name, c.protocol, c.host, c.port, c.username, c.auth_method,
        encPwd, encKey, c.sort_order, c.remark,
        c.color_tag, c.environment, c.auth_type, c.proxy_type, c.proxy_host, c.proxy_port,
        c.proxy_username, encProxy, c.proxy_timeout, c.jump_server_id,
        c.tunnels, c.env_vars, c.advanced, c.created_at, c.updated_at,
      )
      result.connections++
    }

    for (const [k, v] of Object.entries(payload.data.settings)) {
      insertSetting.run(k, JSON.stringify(v))
      result.settings++
    }

    for (const s of payload.data.shortcuts) {
      insertShortcut.run(s.id, s.name, s.command, s.remark, s.sort_order, s.created_at, s.updated_at)
      result.shortcuts++
    }

    result.profiles = Array.isArray(payload.data.terminalProfiles) ? payload.data.terminalProfiles.length : 0
  })()

  return result
}

/** 通过 Provider 导出 */
export async function exportViaProvider(provider: SyncProvider, encryptionKey?: string): Promise<void> {
  const data = exportData(encryptionKey)
  await provider.upload(data)
}

/** 通过 Provider 导入 */
export async function importViaProvider(provider: SyncProvider, encryptionKey?: string): Promise<ImportResult> {
  const data = await provider.download()
  return importData(data, encryptionKey)
}

/** 清空所有业务数据（保留 encryption_meta） */
export function purgeAllData(): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM connections').run()
    db.prepare('DELETE FROM folders').run()
    db.prepare('DELETE FROM settings').run()
    db.prepare('DELETE FROM shortcuts').run()
    db.prepare('DELETE FROM command_history').run()
    db.prepare('DELETE FROM connection_logs').run()
  })()
}
