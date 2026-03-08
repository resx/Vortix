/* ── SSH 密钥库 REST API ── */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import { createGzip } from 'node:zlib'
import { Readable } from 'node:stream'
import * as sshKeyRepo from '../repositories/sshkey.repository.js'

const require = createRequire(import.meta.url)
const { utils } = require('ssh2') as { utils: {
  generateKeyPairSync: (type: string, opts?: Record<string, unknown>) => { private: string; public: string }
}}

const router = Router()

/** GET /api/ssh-keys — 列出所有密钥（元信息） */
router.get('/ssh-keys', (_req: Request, res: Response) => {
  const keys = sshKeyRepo.findAll()
  res.json({ success: true, data: keys })
})

/** GET /api/ssh-keys/:id/private — 获取解密后的私钥 */
router.get('/ssh-keys/:id/private', (req: Request, res: Response) => {
  const privateKey = sshKeyRepo.getPrivateKey(req.params.id)
  if (!privateKey) {
    res.status(404).json({ success: false, error: '密钥不存在' })
    return
  }
  res.json({ success: true, data: { private_key: privateKey } })
})

/** POST /api/ssh-keys — 导入密钥 */
router.post('/ssh-keys', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, private_key, public_key, passphrase, certificate, remark } = req.body
    if (!name || !private_key) {
      res.status(400).json({ success: false, error: '名称和私钥不能为空' })
      return
    }
    const key = sshKeyRepo.create({ name, private_key, public_key, passphrase, certificate, remark })
    res.json({ success: true, data: key })
  } catch (err) { next(err) }
})

interface GenerateBody {
  name: string
  type: 'ed25519' | 'ecdsa' | 'rsa' | 'ml-dsa'
  bits?: number
  passphrase?: string
  comment?: string
}

/** POST /api/ssh-keys/generate — 生成密钥 + 自动保存 */
router.post('/ssh-keys/generate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, bits, passphrase, comment } = req.body as GenerateBody
    if (!name) {
      res.status(400).json({ success: false, error: '密钥名称不能为空' })
      return
    }

    let privateKey: string
    let publicKey: string

    if (type === 'ml-dsa') {
      const result = generateMlDsa(bits)
      if ('error' in result) {
        res.status(400).json({ success: false, error: result.error })
        return
      }
      privateKey = result.privateKey
      publicKey = result.publicKey
    } else {
      const validTypes = ['ed25519', 'ecdsa', 'rsa'] as const
      if (!validTypes.includes(type as typeof validTypes[number])) {
        res.status(400).json({ success: false, error: `不支持的密钥类型: ${type}` })
        return
      }
      const opts: Record<string, unknown> = {}
      if (bits) opts.bits = bits
      if (comment) opts.comment = comment
      if (passphrase) { opts.passphrase = passphrase; opts.cipher = 'aes256-ctr' }
      const keys = utils.generateKeyPairSync(type, opts)
      privateKey = keys.private
      publicKey = keys.public
    }

    // 公钥末尾追加 Vortix 标记（类似 Termius）
    publicKey = appendVortixTag(publicKey)

    // 保存到密钥库
    const saved = sshKeyRepo.create({
      name,
      private_key: privateKey,
      public_key: publicKey,
      passphrase: passphrase || undefined,
      key_type: type,
    })

    res.json({ success: true, data: { ...saved, publicKey } })
  } catch (err) { next(err) }
})

/** PUT /api/ssh-keys/:id — 编辑密钥信息 */
router.put('/ssh-keys/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, public_key, private_key, passphrase, certificate, remark } = req.body
    const updated = sshKeyRepo.update(req.params.id, { name, public_key, private_key, passphrase, certificate, remark })
    if (!updated) {
      res.status(404).json({ success: false, error: '密钥不存在' })
      return
    }
    res.json({ success: true, data: updated })
  } catch (err) { next(err) }
})

/** GET /api/ssh-keys/:id/export — 导出密钥压缩包（tar.gz） */
router.get('/ssh-keys/:id/export', (req: Request, res: Response) => {
  const data = sshKeyRepo.getExportData(req.params.id)
  if (!data) {
    res.status(404).json({ success: false, error: '密钥不存在' })
    return
  }

  // 构建 tar 归档（简易 POSIX tar 格式）
  const files: { name: string; content: string }[] = []
  const prefix = data.name.replace(/[^\w\-. ]/g, '_')

  files.push({ name: `${prefix}/private_key`, content: data.privateKey })
  if (data.publicKey) files.push({ name: `${prefix}/public_key.pub`, content: data.publicKey })
  if (data.passphrase) files.push({ name: `${prefix}/passphrase.txt`, content: data.passphrase })
  if (data.certificate) files.push({ name: `${prefix}/certificate.pem`, content: data.certificate })

  const tarBuffer = buildTar(files)

  // gzip 压缩
  res.setHeader('Content-Type', 'application/gzip')
  res.setHeader('Content-Disposition', `attachment; filename="${prefix}.tar.gz"`)

  const gzip = createGzip()
  Readable.from(tarBuffer).pipe(gzip).pipe(res)
})

/** DELETE /api/ssh-keys/:id — 删除密钥 */
router.delete('/ssh-keys/:id', (req: Request, res: Response) => {
  const ok = sshKeyRepo.remove(req.params.id)
  if (!ok) {
    res.status(404).json({ success: false, error: '密钥不存在' })
    return
  }
  res.json({ success: true, data: null })
})

/* ── 辅助函数 ── */

/** 在公钥末尾追加 [Generated by Vortix] 标记 */
function appendVortixTag(publicKey: string): string {
  const trimmed = publicKey.trimEnd()
  // OpenSSH 格式: "ssh-xxx base64 comment" — 追加到末尾
  // PEM 格式: 保持原样，在最后一行前插入注释不合适，直接追加一行
  if (trimmed.startsWith('-----')) {
    return trimmed + '\n# [Generated by Vortix]\n'
  }
  return trimmed + ' [Generated by Vortix]\n'
}

/** ML-DSA 密钥生成 */
function generateMlDsa(bits?: number): { privateKey: string; publicKey: string } | { error: string } {
  const paramMap: Record<number, string> = { 44: 'ml-dsa-44', 65: 'ml-dsa-65', 87: 'ml-dsa-87' }
  const algo = paramMap[bits || 65]
  if (!algo) return { error: 'ML-DSA 参数集无效，支持: 44, 65, 87' }

  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync(algo as 'ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    return { privateKey, publicKey }
  } catch {
    return { error: `ML-DSA 需要 OpenSSL 3.5+（当前: ${process.versions.openssl}），请升级到 Node.js 24+ 或选择其他密钥类型` }
  }
}

/** 构建简易 POSIX tar 归档 */
function buildTar(files: { name: string; content: string }[]): Buffer {
  const blocks: Buffer[] = []

  for (const file of files) {
    const content = Buffer.from(file.content, 'utf8')
    const header = Buffer.alloc(512, 0)

    // 文件名（最多 100 字节）
    header.write(file.name.slice(0, 100), 0, 100, 'utf8')
    // 文件模式
    header.write('0000644\0', 100, 8, 'utf8')
    // uid / gid
    header.write('0000000\0', 108, 8, 'utf8')
    header.write('0000000\0', 116, 8, 'utf8')
    // 文件大小（八进制）
    header.write(content.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'utf8')
    // 修改时间
    const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0'
    header.write(mtime, 136, 12, 'utf8')
    // 类型标志: 普通文件
    header.write('0', 156, 1, 'utf8')
    // magic
    header.write('ustar\0', 257, 6, 'utf8')
    header.write('00', 263, 2, 'utf8')

    // 计算校验和
    header.write('        ', 148, 8, 'utf8') // 先填空格
    let checksum = 0
    for (let i = 0; i < 512; i++) checksum += header[i]
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'utf8')

    blocks.push(header)
    blocks.push(content)

    // 填充到 512 字节边界
    const padding = 512 - (content.length % 512)
    if (padding < 512) blocks.push(Buffer.alloc(padding, 0))
  }

  // tar 结尾：两个空块
  blocks.push(Buffer.alloc(1024, 0))
  return Buffer.concat(blocks)
}

export default router
