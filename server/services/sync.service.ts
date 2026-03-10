/* ── 云同步服务：v3 JSON 格式 + 字段级加密 + 冲突检测 ── */

import crypto from 'crypto'
import { folderStore, connectionStore, shortcutStore, sshKeyStore, historyStore, logStore } from '../db/stores.js'
import * as folderRepo from '../repositories/folder.repository.js'
import * as connectionRepo from '../repositories/connection.repository.js'
import * as shortcutRepo from '../repositories/shortcut.repository.js'
import * as cryptoService from './crypto.service.js'
import * as syncState from './sync-state.service.js'
import type { SyncProvider } from './sync-providers/types.js'
import type {
  SyncPayloadV3, SyncPayloadLegacy, SyncPayload,
  SyncConnection, SyncSshKey, ImportResult, ConnectionRow, SshKeyRow,
  SyncConflictInfo,
} from '../types/index.js'

// ── 旧版二进制格式常量 ──
const MAGIC = Buffer.from('VTXS')
const LEGACY_VERSION_ENCRYPTED = 1
const LEGACY_VERSION_PLAINTEXT = 2

// ── 加密常量 ──
const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const TAG_LENGTH = 16
const ENC_PREFIX = 'ENC:'

/** 内置应用密钥（第一层加密）— 防止非 Vortix 用户直接读取明文，非强加密 */
const BUILTIN_APP_SECRET = 'vortix-sync-builtin-v1-2024'

// ── 字段级加密需要处理的字段 ──
const CONNECTION_SENSITIVE_FIELDS = ['password', 'private_key', 'proxy_password'] as const
const SSHKEY_SENSITIVE_FIELDS = ['private_key', 'passphrase'] as const

/* ══════════════════════════════════════════
   字段级加密/解密
   ══════════════════════════════════════════ */

/** 从同步密码派生 AES-256 密钥 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256')
}

/** 字段级加密：返回 "ENC:" + base64(iv + tag + ciphertext) */
function encryptField(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ENC_PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/** 字段级解密：解析 "ENC:..." 格式 */
function decryptField(value: string, key: Buffer): string {
  if (!value.startsWith(ENC_PREFIX)) return value
  const combined = Buffer.from(value.slice(ENC_PREFIX.length), 'base64')
  const iv = combined.subarray(0, IV_LENGTH)
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/** 对连接的敏感字段加密 */
function encryptConnectionFields(conn: SyncConnection, key: Buffer): SyncConnection {
  const result = { ...conn }
  for (const field of CONNECTION_SENSITIVE_FIELDS) {
    const val = result[field]
    if (val) (result as Record<string, unknown>)[field] = encryptField(val, key)
  }
  return result
}

/** 对连接的敏感字段解密 */
function decryptConnectionFields(conn: SyncConnection, key: Buffer): SyncConnection {
  const result = { ...conn }
  for (const field of CONNECTION_SENSITIVE_FIELDS) {
    const val = result[field]
    if (val && typeof val === 'string' && val.startsWith(ENC_PREFIX)) {
      try { (result as Record<string, unknown>)[field] = decryptField(val, key) } catch { /* 解密失败保留原值 */ }
    }
  }
  return result
}

/** 对 SSH 密钥的敏感字段加密 */
function encryptSshKeyFields(sshKey: SyncSshKey, key: Buffer): SyncSshKey {
  const result = { ...sshKey }
  for (const field of SSHKEY_SENSITIVE_FIELDS) {
    const val = result[field]
    if (val) (result as Record<string, unknown>)[field] = encryptField(val, key)
  }
  return result
}

/** 对 SSH 密钥的敏感字段解密 */
function decryptSshKeyFields(sshKey: SyncSshKey, key: Buffer): SyncSshKey {
  const result = { ...sshKey }
  for (const field of SSHKEY_SENSITIVE_FIELDS) {
    const val = result[field]
    if (val && typeof val === 'string' && val.startsWith(ENC_PREFIX)) {
      try { (result as Record<string, unknown>)[field] = decryptField(val, key) } catch { /* */ }
    }
  }
  return result
}

/* ══════════════════════════════════════════
   数据收集
   ══════════════════════════════════════════ */

/** 将 ConnectionRow 转为 SyncConnection（解密凭据） */
function rowToSyncConnection(row: ConnectionRow): SyncConnection {
  let password: string | null = null
  let privateKey: string | null = null
  let proxyPassword: string | null = null

  try { if (row.encrypted_password) password = cryptoService.decrypt(row.encrypted_password) } catch { /* */ }
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

/** 收集全量同步数据（明文） */
function collectRawData() {
  const folders = folderRepo.findAll()
  const rawConnections = connectionRepo.findAllRaw()
  const shortcuts = shortcutRepo.findAll()
  const connections: SyncConnection[] = rawConnections.map(rowToSyncConnection)

  const rawKeys = sshKeyStore.findAll()
  const sshKeys: SyncSshKey[] = rawKeys.map((row) => ({
    id: row.id, name: row.name, key_type: row.key_type,
    private_key: cryptoService.decrypt(row.encrypted_private_key),
    public_key: row.public_key,
    passphrase: row.encrypted_passphrase ? cryptoService.decrypt(row.encrypted_passphrase) : null,
    certificate: row.certificate, remark: row.remark ?? '', description: row.description ?? '',
    created_at: row.created_at,
  }))

  return { folders, connections, shortcuts, sshKeys }
}

/* ══════════════════════════════════════════
   v3 JSON 导出
   ══════════════════════════════════════════ */

// PLACEHOLDER_EXPORT_IMPORT

/** 导出 v3 JSON 同步数据 */
export function exportData(encryptionKey?: string): Buffer {
  const state = syncState.getSyncState()
  const raw = collectRawData()
  const newRevision = state.lastSyncRevision + 1

  // 分层加密：用户密钥优先，否则用内置密钥
  const effectiveKey = encryptionKey || BUILTIN_APP_SECRET
  const encryptionType: 'builtin' | 'user' = encryptionKey ? 'user' : 'builtin'

  const salt = crypto.randomBytes(SALT_LENGTH)
  const derivedKey = deriveKey(effectiveKey, salt)
  const connections = raw.connections.map((c) => encryptConnectionFields(c, derivedKey))
  const sshKeys = raw.sshKeys.map((k) => encryptSshKeyFields(k, derivedKey))

  const data = {
    folders: raw.folders,
    connections,
    shortcuts: raw.shortcuts,
    sshKeys,
  }

  // 计算 data 的 checksum
  const dataJson = JSON.stringify(data)
  const checksum = 'sha256:' + crypto.createHash('sha256').update(dataJson).digest('hex')

  const payload: SyncPayloadV3 = {
    $schema: 'vortix-sync',
    version: 3,
    deviceId: state.deviceId,
    exportedAt: new Date().toISOString(),
    checksum,
    syncMeta: {
      revision: newRevision,
      lastSyncDeviceId: state.deviceId,
      encryptionSalt: salt.toString('hex'),
      encryptionType,
    },
    data,
  }

  // 更新本地同步状态
  syncState.onSyncSuccess(newRevision)

  return Buffer.from(JSON.stringify(payload, null, 2), 'utf8')
}

/* ══════════════════════════════════════════
   导入（兼容 v3 JSON + 旧版二进制）
   ══════════════════════════════════════════ */

/** 判断是否为 v3 JSON 格式 */
function isV3Json(buf: Buffer): boolean {
  try {
    // 快速检测：JSON 以 { 开头
    if (buf[0] !== 0x7b) return false
    const parsed = JSON.parse(buf.toString('utf8'))
    return parsed.$schema === 'vortix-sync' && parsed.version === 3
  } catch { return false }
}

/** 判断是否为旧版二进制格式 */
function isLegacyBinary(buf: Buffer): boolean {
  return buf.length >= 6 && buf.subarray(0, 4).equals(MAGIC)
}

/** 解析旧版二进制格式 */
function parseLegacyBinary(buf: Buffer, encryptionKey?: string): SyncPayloadLegacy {
  const version = buf.readUInt16BE(4)

  if (version === LEGACY_VERSION_PLAINTEXT) {
    return JSON.parse(buf.subarray(6).toString('utf8'))
  }

  if (version === LEGACY_VERSION_ENCRYPTED) {
    if (!encryptionKey) throw new Error('该同步文件已加密，请提供加密密钥')
    const salt = buf.subarray(6, 6 + SALT_LENGTH)
    const iv = buf.subarray(22, 22 + IV_LENGTH)
    const tag = buf.subarray(34, 34 + TAG_LENGTH)
    const encrypted = buf.subarray(50)
    const key = deriveKey(encryptionKey, salt)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    try {
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
      return JSON.parse(decrypted.toString('utf8'))
    } catch {
      throw new Error('同步密码错误或文件已损坏')
    }
  }

  throw new Error(`不支持的同步文件版本: ${version}`)
}

/** 解析 v3 JSON 格式（解密字段级加密） */
function parseV3Json(buf: Buffer, encryptionKey?: string): { payload: SyncPayloadV3; revision: number } {
  const payload: SyncPayloadV3 = JSON.parse(buf.toString('utf8'))

  // 校验 checksum
  const dataJson = JSON.stringify(payload.data)
  const expected = 'sha256:' + crypto.createHash('sha256').update(dataJson).digest('hex')
  if (payload.checksum !== expected) {
    throw new Error('同步文件校验失败，数据可能已损坏')
  }

  // 如果有加密字段，需要解密
  if (payload.syncMeta.encryptionSalt) {
    const salt = Buffer.from(payload.syncMeta.encryptionSalt, 'hex')
    const type = payload.syncMeta.encryptionType
    let effectiveKey: string

    if (type === 'user') {
      if (!encryptionKey) throw new Error('该同步文件使用自定义密钥加密，请提供加密密钥')
      effectiveKey = encryptionKey
    } else if (type === 'builtin') {
      effectiveKey = BUILTIN_APP_SECRET
    } else {
      // 旧版数据（有 salt 无 type）：需要用户密钥
      if (!encryptionKey) throw new Error('该同步文件包含加密字段，请提供加密密钥')
      effectiveKey = encryptionKey
    }

    const key = deriveKey(effectiveKey, salt)
    try {
      payload.data.connections = payload.data.connections.map((c) => decryptConnectionFields(c, key))
      payload.data.sshKeys = payload.data.sshKeys.map((k) => decryptSshKeyFields(k, key))
    } catch {
      throw new Error(type === 'user' ? '解密失败，请检查加密密钥是否正确' : '同步文件解密失败，数据可能已损坏')
    }
  }

  return { payload, revision: payload.syncMeta.revision }
}

// PLACEHOLDER_APPLY_AND_REST

/**
 * 导入同步数据（自动检测 v3 JSON / 旧版二进制）
 */
export function importData(fileBuffer: Buffer, encryptionKey?: string): ImportResult {
  let normalizedData: SyncPayloadV3['data']
  let revision = 1

  if (isV3Json(fileBuffer)) {
    const result = parseV3Json(fileBuffer, encryptionKey)
    normalizedData = result.payload.data
    revision = result.revision
  } else if (isLegacyBinary(fileBuffer)) {
    const legacy = parseLegacyBinary(fileBuffer, encryptionKey)
    normalizedData = {
      folders: legacy.data.folders,
      connections: legacy.data.connections,
      shortcuts: legacy.data.shortcuts,
      sshKeys: legacy.data.sshKeys ?? [],
    }
  } else {
    throw new Error('无效的同步文件格式')
  }

  const result = applyPayload(normalizedData)
  syncState.onSyncSuccess(revision)
  return result
}

/** 将 payload 写入 JSON 存储 */
function applyPayload(data: SyncPayloadV3['data']): ImportResult {
  const result: ImportResult = { folders: 0, connections: 0, shortcuts: 0, sshKeys: 0 }

  // 清空并写入 folders
  folderStore.replaceAll(data.folders)
  result.folders = data.folders.length

  // 清空并写入 connections（加密凭据）
  const connRows: ConnectionRow[] = data.connections.map((c) => ({
    id: c.id, folder_id: c.folder_id, name: c.name, protocol: c.protocol,
    host: c.host, port: c.port, username: c.username, auth_method: c.auth_method,
    encrypted_password: c.password ? cryptoService.encrypt(c.password) : null,
    encrypted_private_key: c.private_key ? cryptoService.encrypt(c.private_key) : null,
    sort_order: c.sort_order, remark: c.remark, color_tag: c.color_tag,
    environment: c.environment, auth_type: c.auth_type,
    proxy_type: c.proxy_type, proxy_host: c.proxy_host, proxy_port: c.proxy_port,
    proxy_username: c.proxy_username,
    proxy_password: c.proxy_password ? cryptoService.encrypt(c.proxy_password) : '',
    proxy_timeout: c.proxy_timeout, jump_server_id: c.jump_server_id,
    tunnels: c.tunnels, env_vars: c.env_vars, advanced: c.advanced,
    created_at: c.created_at, updated_at: c.updated_at,
  }))
  connectionStore.replaceAll(connRows)
  result.connections = connRows.length

  // 清空并写入 shortcuts
  shortcutStore.replaceAll(data.shortcuts)
  result.shortcuts = data.shortcuts.length

  // 清空并写入 sshKeys（加密私钥）
  const keyRows: SshKeyRow[] = data.sshKeys.map((k) => ({
    id: k.id, name: k.name, key_type: k.key_type,
    encrypted_private_key: cryptoService.encrypt(k.private_key),
    public_key: k.public_key,
    has_passphrase: !!k.passphrase,
    encrypted_passphrase: k.passphrase ? cryptoService.encrypt(k.passphrase) : null,
    certificate: k.certificate, remark: k.remark ?? '', description: k.description ?? '',
    created_at: k.created_at,
  }))
  sshKeyStore.replaceAll(keyRows)
  result.sshKeys = keyRows.length

  return result
}

/* ══════════════════════════════════════════
   冲突检测
   ══════════════════════════════════════════ */

/** 从远端数据中提取 syncMeta（不解密数据） */
function peekRemoteMeta(buf: Buffer): { revision: number; deviceId: string; exportedAt: string } | null {
  try {
    if (isV3Json(buf)) {
      const parsed = JSON.parse(buf.toString('utf8'))
      return {
        revision: parsed.syncMeta?.revision ?? 0,
        deviceId: parsed.deviceId ?? '',
        exportedAt: parsed.exportedAt ?? '',
      }
    }
    // 旧版格式没有 revision，视为 0
    return { revision: 0, deviceId: '', exportedAt: '' }
  } catch { return null }
}

/** 检测推送冲突 */
export async function checkPushConflict(provider: SyncProvider): Promise<SyncConflictInfo> {
  const state = syncState.getSyncState()
  try {
    const remoteBuf = await provider.download()
    const meta = peekRemoteMeta(remoteBuf)
    if (!meta) {
      return { hasConflict: false, localRevision: state.lastSyncRevision, remoteRevision: 0 }
    }
    // 远端 revision > 本地已知 revision → 冲突
    if (meta.revision > state.lastSyncRevision) {
      return {
        hasConflict: true,
        reason: 'remote_ahead',
        localRevision: state.lastSyncRevision,
        remoteRevision: meta.revision,
        remoteDeviceId: meta.deviceId,
        remoteExportedAt: meta.exportedAt,
      }
    }
    return { hasConflict: false, localRevision: state.lastSyncRevision, remoteRevision: meta.revision }
  } catch {
    // 远端文件不存在，无冲突
    return { hasConflict: false, localRevision: state.lastSyncRevision, remoteRevision: 0 }
  }
}

/** 检测拉取冲突 */
export async function checkPullConflict(provider: SyncProvider): Promise<SyncConflictInfo> {
  const state = syncState.getSyncState()
  try {
    const remoteBuf = await provider.download()
    const meta = peekRemoteMeta(remoteBuf)
    if (!meta) {
      return { hasConflict: false, localRevision: state.lastSyncRevision, remoteRevision: 0 }
    }
    // 本地有未同步变更且远端有更新 → 冲突
    if (state.localDirty && meta.revision > state.lastSyncRevision) {
      return {
        hasConflict: true,
        reason: 'local_dirty',
        localRevision: state.lastSyncRevision,
        remoteRevision: meta.revision,
        remoteDeviceId: meta.deviceId,
        remoteExportedAt: meta.exportedAt,
      }
    }
    return { hasConflict: false, localRevision: state.lastSyncRevision, remoteRevision: meta.revision }
  } catch {
    return { hasConflict: false, localRevision: state.lastSyncRevision, remoteRevision: 0 }
  }
}

/* ══════════════════════════════════════════
   Provider 操作
   ══════════════════════════════════════════ */

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

/** 清空所有同步数据（不影响设置） */
export function purgeAllData(): void {
  folderStore.clear()
  connectionStore.clear()
  shortcutStore.clear()
  sshKeyStore.clear()
  historyStore.clear()
  logStore.clear()
}
