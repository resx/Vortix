/* ── SSH 密钥库 Repository ── */

import crypto from 'crypto'
import { getDb } from '../db/database.js'
import { encrypt, decrypt } from '../services/crypto.service.js'
import type { SshKey, SshKeyRow, CreateSshKeyDto, UpdateSshKeyDto } from '../types/index.js'

const SELECT_COLS = 'id, name, key_type, public_key, (encrypted_passphrase IS NOT NULL) as has_passphrase, certificate, remark, description, created_at'

/** 列出所有密钥（不含私钥/密码短语明文） */
export function findAll(): SshKey[] {
  const db = getDb()
  const rows = db.prepare(`SELECT ${SELECT_COLS} FROM ssh_keys ORDER BY created_at DESC`).all() as (Omit<SshKey, 'has_passphrase'> & { has_passphrase: number })[]
  return rows.map(r => ({ ...r, has_passphrase: !!r.has_passphrase }))
}

/** 按 ID 查找（不含私钥/密码短语明文） */
export function findById(id: string): SshKey | undefined {
  const db = getDb()
  const row = db.prepare(`SELECT ${SELECT_COLS} FROM ssh_keys WHERE id = ?`).get(id) as (Omit<SshKey, 'has_passphrase'> & { has_passphrase: number }) | undefined
  if (!row) return undefined
  return { ...row, has_passphrase: !!row.has_passphrase }
}

/** 获取解密后的私钥 */
export function getPrivateKey(id: string): string | undefined {
  const db = getDb()
  const row = db.prepare('SELECT encrypted_private_key FROM ssh_keys WHERE id = ?').get(id) as Pick<SshKeyRow, 'encrypted_private_key'> | undefined
  if (!row) return undefined
  return decrypt(row.encrypted_private_key)
}

/** 获取解密后的密码短语 */
export function getPassphrase(id: string): string | undefined {
  const db = getDb()
  const row = db.prepare('SELECT encrypted_passphrase FROM ssh_keys WHERE id = ?').get(id) as Pick<SshKeyRow, 'encrypted_passphrase'> | undefined
  if (!row?.encrypted_passphrase) return undefined
  return decrypt(row.encrypted_passphrase)
}

/** 获取导出所需的完整数据 */
export function getExportData(id: string): {
  name: string
  privateKey: string
  publicKey: string | null
  passphrase: string | null
  certificate: string | null
} | undefined {
  const db = getDb()
  const row = db.prepare('SELECT name, encrypted_private_key, public_key, encrypted_passphrase, certificate FROM ssh_keys WHERE id = ?').get(id) as {
    name: string; encrypted_private_key: string; public_key: string | null; encrypted_passphrase: string | null; certificate: string | null
  } | undefined
  if (!row) return undefined
  return {
    name: row.name,
    privateKey: decrypt(row.encrypted_private_key),
    publicKey: row.public_key,
    passphrase: row.encrypted_passphrase ? decrypt(row.encrypted_passphrase) : null,
    certificate: row.certificate,
  }
}

/** 创建密钥 */
export function create(dto: CreateSshKeyDto): SshKey {
  const db = getDb()
  const id = crypto.randomUUID()
  const encryptedKey = encrypt(dto.private_key)
  const encryptedPass = dto.passphrase ? encrypt(dto.passphrase) : null
  const keyType = dto.key_type ?? guessKeyType(dto.private_key)

  db.prepare(`
    INSERT INTO ssh_keys (id, name, key_type, encrypted_private_key, public_key, encrypted_passphrase, certificate, remark, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, dto.name, keyType, encryptedKey, dto.public_key ?? null, encryptedPass, dto.certificate ?? null, dto.remark ?? '', dto.description ?? '')

  return findById(id)!
}

/** 更新密钥信息 */
export function update(id: string, dto: UpdateSshKeyDto): SshKey | undefined {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM ssh_keys WHERE id = ?').get(id) as SshKeyRow | undefined
  if (!existing) return undefined

  const name = dto.name ?? existing.name
  const publicKey = dto.public_key !== undefined ? dto.public_key : existing.public_key
  const certificate = dto.certificate !== undefined ? dto.certificate : existing.certificate
  const remark = dto.remark ?? existing.remark

  // 私钥：仅在提供新值时更新
  let encryptedPrivateKey = existing.encrypted_private_key
  if (dto.private_key) {
    encryptedPrivateKey = encrypt(dto.private_key)
  }

  // 密码短语：null 表示清除，string 表示更新
  let encryptedPassphrase = existing.encrypted_passphrase
  if (dto.passphrase === null) {
    encryptedPassphrase = null
  } else if (dto.passphrase) {
    encryptedPassphrase = encrypt(dto.passphrase)
  }

  // 重新推断 key_type
  const keyType = dto.private_key ? guessKeyType(dto.private_key) : existing.key_type

  db.prepare(`
    UPDATE ssh_keys SET name = ?, key_type = ?, encrypted_private_key = ?, public_key = ?, encrypted_passphrase = ?, certificate = ?, remark = ?
    WHERE id = ?
  `).run(name, keyType, encryptedPrivateKey, publicKey, encryptedPassphrase, certificate, remark, id)

  return findById(id)
}

/** 删除密钥 */
export function remove(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM ssh_keys WHERE id = ?').run(id)
  return result.changes > 0
}

/** 从私钥内容猜测密钥类型 */
function guessKeyType(key: string): string {
  // 旧格式 PEM 头部直接包含类型
  if (key.includes('BEGIN RSA PRIVATE KEY')) return 'rsa'
  if (key.includes('BEGIN EC PRIVATE KEY')) return 'ecdsa'
  if (key.includes('BEGIN DSA PRIVATE KEY')) return 'dsa'

  // 新格式 OpenSSH: 头部统一为 BEGIN OPENSSH PRIVATE KEY
  // 需要解析 base64 内容中的密钥类型字符串
  if (key.includes('BEGIN OPENSSH PRIVATE KEY')) {
    try {
      const b64 = key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
      const buf = Buffer.from(b64, 'base64')
      const ascii = buf.toString('ascii')
      // 公钥部分包含类型标识符
      if (ascii.includes('ssh-ed25519')) return 'ed25519'
      if (ascii.includes('ecdsa-sha2')) return 'ecdsa'
      if (ascii.includes('ssh-rsa')) return 'rsa'
      if (ascii.includes('ssh-dss')) return 'dsa'
    } catch {
      // 解析失败，继续用文本匹配
    }
  }

  // PEM PKCS#8 格式（ML-DSA 等）
  if (key.includes('ML-DSA') || key.includes('ml-dsa')) return 'ml-dsa'

  // 最后兜底：文本匹配
  const lower = key.toLowerCase()
  if (lower.includes('rsa')) return 'rsa'
  if (lower.includes('ed25519')) return 'ed25519'
  if (lower.includes('ecdsa')) return 'ecdsa'

  return 'unknown'
}
