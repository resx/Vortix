/* ── SSH 密钥库 Repository ── */

import crypto from 'crypto'
import { sshKeyStore } from '../db/stores.js'
import { encrypt, decrypt } from '../services/crypto.service.js'
import { markDirty } from '../services/auto-sync.service.js'
import type { SshKey, SshKeyRow, CreateSshKeyDto, UpdateSshKeyDto } from '../types/index.js'

/** 将 SshKeyRow 转为 API 安全的 SshKey（不含私钥/密码短语明文） */
function toSshKey(row: SshKeyRow): SshKey {
  return {
    id: row.id, name: row.name, key_type: row.key_type,
    public_key: row.public_key, has_passphrase: !!row.encrypted_passphrase,
    certificate: row.certificate, remark: row.remark,
    description: row.description, created_at: row.created_at,
  }
}

/** 列出所有密钥（不含私钥/密码短语明文） */
export function findAll(): SshKey[] {
  return sshKeyStore.findAll()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toSshKey)
}

/** 按 ID 查找（不含私钥/密码短语明文） */
export function findById(id: string): SshKey | undefined {
  const row = sshKeyStore.findById(id)
  return row ? toSshKey(row) : undefined
}

/** 获取解密后的私钥 */
export function getPrivateKey(id: string): string | undefined {
  const row = sshKeyStore.findById(id)
  if (!row) return undefined
  return decrypt(row.encrypted_private_key)
}

/** 获取解密后的密码短语 */
export function getPassphrase(id: string): string | undefined {
  const row = sshKeyStore.findById(id)
  if (!row?.encrypted_passphrase) return undefined
  return decrypt(row.encrypted_passphrase)
}

/** 获取导出所需的完整数据 */
export function getExportData(id: string): {
  name: string; privateKey: string; publicKey: string | null
  passphrase: string | null; certificate: string | null
} | undefined {
  const row = sshKeyStore.findById(id)
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
  const id = crypto.randomUUID()
  const encryptedKey = encrypt(dto.private_key)
  const encryptedPass = dto.passphrase ? encrypt(dto.passphrase) : null
  const keyType = dto.key_type ?? guessKeyType(dto.private_key)
  const now = new Date().toISOString()

  const row: SshKeyRow = {
    id, name: dto.name, key_type: keyType,
    encrypted_private_key: encryptedKey,
    public_key: dto.public_key ?? null,
    has_passphrase: !!encryptedPass,
    encrypted_passphrase: encryptedPass,
    certificate: dto.certificate ?? null,
    remark: dto.remark ?? '',
    description: dto.description ?? '',
    created_at: now,
  }
  sshKeyStore.insert(row)
  markDirty()
  return toSshKey(row)
}

/** 更新密钥信息 */
export function update(id: string, dto: UpdateSshKeyDto): SshKey | undefined {
  const result = sshKeyStore.update(id, (existing) => {
    let encryptedPrivateKey = existing.encrypted_private_key
    if (dto.private_key) encryptedPrivateKey = encrypt(dto.private_key)

    let encryptedPassphrase = existing.encrypted_passphrase
    if (dto.passphrase === null) encryptedPassphrase = null
    else if (dto.passphrase) encryptedPassphrase = encrypt(dto.passphrase)

    const keyType = dto.private_key ? guessKeyType(dto.private_key) : existing.key_type

    return {
      ...existing,
      name: dto.name ?? existing.name,
      key_type: keyType,
      encrypted_private_key: encryptedPrivateKey,
      public_key: dto.public_key !== undefined ? dto.public_key : existing.public_key,
      has_passphrase: !!encryptedPassphrase,
      encrypted_passphrase: encryptedPassphrase,
      certificate: dto.certificate !== undefined ? dto.certificate : existing.certificate,
      remark: dto.remark ?? existing.remark,
    }
  })
  if (result) {
    markDirty()
    return toSshKey(result)
  }
  return undefined
}

/** 删除密钥 */
export function remove(id: string): boolean {
  const ok = sshKeyStore.remove(id)
  if (ok) markDirty()
  return ok
}

/** 从私钥内容猜测密钥类型 */
function guessKeyType(key: string): string {
  if (key.includes('BEGIN RSA PRIVATE KEY')) return 'rsa'
  if (key.includes('BEGIN EC PRIVATE KEY')) return 'ecdsa'
  if (key.includes('BEGIN DSA PRIVATE KEY')) return 'dsa'

  if (key.includes('BEGIN OPENSSH PRIVATE KEY')) {
    try {
      const b64 = key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
      const buf = Buffer.from(b64, 'base64')
      const ascii = buf.toString('ascii')
      if (ascii.includes('ssh-ed25519')) return 'ed25519'
      if (ascii.includes('ecdsa-sha2')) return 'ecdsa'
      if (ascii.includes('ssh-rsa')) return 'rsa'
      if (ascii.includes('ssh-dss')) return 'dsa'
    } catch { /* */ }
  }

  if (key.includes('ML-DSA') || key.includes('ml-dsa')) return 'ml-dsa'

  const lower = key.toLowerCase()
  if (lower.includes('rsa')) return 'rsa'
  if (lower.includes('ed25519')) return 'ed25519'
  if (lower.includes('ecdsa')) return 'ecdsa'

  return 'unknown'
}
