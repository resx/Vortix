/* ── AES-256-GCM 加密/解密服务 ── */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENCRYPTION_KEY_PATH = path.resolve(__dirname, '../../data/encryption.key')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

/** 获取或自动生成加密密钥 */
function getEncryptionKey(): Buffer {
  try {
    if (fs.existsSync(ENCRYPTION_KEY_PATH)) {
      const hex = fs.readFileSync(ENCRYPTION_KEY_PATH, 'utf8').trim()
      return Buffer.from(hex, 'hex')
    }
  } catch { /* 文件损坏则重新生成 */ }

  // 首次运行：生成 256 位随机密钥
  const key = crypto.randomBytes(32)
  const dir = path.dirname(ENCRYPTION_KEY_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(ENCRYPTION_KEY_PATH, key.toString('hex'), 'utf8')
  console.log('[Vortix] 已自动生成加密密钥')
  return key
}

/** 加密明文，返回 base64 编码的密文（iv + tag + ciphertext） */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  // 拼接: iv(12) + tag(16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted])
  return combined.toString('base64')
}

/** 解密 base64 编码的密文，返回明文 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(ciphertext, 'base64')

  const iv = combined.subarray(0, IV_LENGTH)
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
