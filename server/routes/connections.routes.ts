/* ── 连接路由 ── */

import { Router } from 'express'
import { Client as SshClient } from 'ssh2'
import { spawn } from 'child_process'
import { existsSync, statSync } from 'fs'
import { Socket } from 'net'
import * as connectionRepo from '../repositories/connection.repository.js'
import * as sshKeyRepo from '../repositories/sshkey.repository.js'
import { encrypt, decrypt } from '../services/crypto.service.js'

const router = Router()

// 获取所有连接
router.get('/connections', (req, res) => {
  const folderId = req.query.folder_id as string | undefined
  const connections = connectionRepo.findAll(folderId)
  res.json({ success: true, data: connections })
})

// 获取所有已配置私钥的连接（返回 id、名称、解密后的私钥）
router.get('/connections/keys', (_req, res) => {
  try {
    const allRaw = connectionRepo.findAllRaw()
    const keys = allRaw
      .filter(r => !!r.encrypted_private_key)
      .map(r => {
        let privateKey = ''
        try { privateKey = decrypt(r.encrypted_private_key!) } catch { /* */ }
        return { id: r.id, name: r.name, host: r.host, privateKey }
      })
      .filter(k => !!k.privateKey)
    res.json({ success: true, data: keys })
  } catch (e) {
    res.json({ success: false, error: (e as Error).message })
  }
})

// 获取单个连接
router.get('/connections/:id', (req, res) => {
  const connection = connectionRepo.findById(req.params.id)
  if (!connection) {
    res.status(404).json({ success: false, error: '连接不存在' })
    return
  }
  res.json({ success: true, data: connection })
})

// 获取解密凭据（仅建连时调用）
router.get('/connections/:id/credential', (req, res) => {
  const raw = connectionRepo.findRawById(req.params.id)
  if (!raw) {
    res.status(404).json({ success: false, error: '连接不存在' })
    return
  }

  const credential: Record<string, unknown> = {
    host: raw.host,
    port: raw.port,
    username: raw.username,
  }

  if (raw.encrypted_password) {
    credential.password = decrypt(raw.encrypted_password)
  }
  if (raw.encrypted_private_key) {
    credential.private_key = decrypt(raw.encrypted_private_key)
  }
  if (raw.proxy_password) {
    credential.proxy_password = decrypt(raw.proxy_password)
  }

  res.json({ success: true, data: credential })
})

// 创建连接
router.post('/connections', (req, res) => {
  const { name, host, username, password, private_key, proxy_password, ...rest } = req.body
  const isLocal = rest.protocol === 'local'
  if (!name || (!isLocal && (!host || !username))) {
    res.status(400).json({ success: false, error: isLocal ? '名称不能为空' : '名称、主机和用户名不能为空' })
    return
  }
  // 输入长度/范围验证
  if (typeof name !== 'string' || name.length > 255) {
    res.status(400).json({ success: false, error: '名称长度不能超过 255' })
    return
  }
  if (!isLocal) {
    if (typeof host !== 'string' || host.length > 255) {
      res.status(400).json({ success: false, error: '主机地址长度不能超过 255' })
      return
    }
    if (typeof username !== 'string' || username.length > 255) {
      res.status(400).json({ success: false, error: '用户名长度不能超过 255' })
      return
    }
    const port = rest.port
    if (port !== undefined && port !== null) {
      const p = Number(port)
      if (!Number.isInteger(p) || p < 1 || p > 65535) {
        res.status(400).json({ success: false, error: '端口号必须在 1-65535 之间' })
        return
      }
    }
  }

  const encryptedPassword = password ? encrypt(password) : null
  const encryptedPrivateKey = private_key ? encrypt(private_key) : null
  const encryptedProxyPassword = proxy_password ? encrypt(proxy_password) : null

  const connection = connectionRepo.create(
    { name, host, username, ...rest },
    encryptedPassword,
    encryptedPrivateKey,
    encryptedProxyPassword,
  )
  res.status(201).json({ success: true, data: connection })
})

// 更新连接
router.put('/connections/:id', (req, res) => {
  const { id } = req.params
  const { password, private_key, proxy_password, ...rest } = req.body

  // 仅在明确传入时更新凭据
  const encryptedPassword = password !== undefined ? (password ? encrypt(password) : null) : undefined
  const encryptedPrivateKey = private_key !== undefined ? (private_key ? encrypt(private_key) : null) : undefined
  const encryptedProxyPassword = proxy_password !== undefined ? (proxy_password ? encrypt(proxy_password) : null) : undefined

  const connection = connectionRepo.update(id, rest, encryptedPassword, encryptedPrivateKey, encryptedProxyPassword)
  if (!connection) {
    res.status(404).json({ success: false, error: '连接不存在' })
    return
  }
  res.json({ success: true, data: connection })
})

// 删除连接
router.delete('/connections/:id', (req, res) => {
  const deleted = connectionRepo.remove(req.params.id)
  if (!deleted) {
    res.status(404).json({ success: false, error: '连接不存在' })
    return
  }
  res.json({ success: true })
})

// ── 测试连接 ──

// 批量 TCP Ping
router.post('/connections/ping', async (req, res) => {
  const { ids } = req.body as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    res.json({ success: true, data: {} })
    return
  }
  // 限制批量 ping 数量
  if (ids.length > 50) {
    res.status(400).json({ success: false, error: '批量 ping 数量不能超过 50' })
    return
  }

  const results: Record<string, number | null> = {}

  await Promise.all(ids.map(async (id) => {
    const raw = connectionRepo.findRawById(id)
    if (!raw || raw.protocol === 'local' || !raw.host) {
      results[id] = null
      return
    }

    const start = Date.now()
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new Socket()
        const timer = setTimeout(() => {
          socket.destroy()
          reject(new Error('timeout'))
        }, 5000)

        socket.connect(raw.port || 22, raw.host, () => {
          clearTimeout(timer)
          socket.destroy()
          resolve()
        })
        socket.on('error', (err) => {
          clearTimeout(timer)
          socket.destroy()
          reject(err)
        })
      })
      results[id] = Date.now() - start
    } catch {
      results[id] = null
    }
  }))

  res.json({ success: true, data: results })
})

// SSH 测试连接
router.post('/connections/test-ssh', (req, res) => {
  const { host, port, username, password, privateKey } = req.body
  if (!host || !username) {
    res.status(400).json({ success: false, error: '主机和用户名不能为空' })
    return
  }

  const client = new SshClient()
  const timeout = setTimeout(() => {
    client.end()
    res.json({ success: false, error: '连接超时（10s）' })
  }, 10000)

  const connConfig: Record<string, unknown> = {
    host,
    port: port || 22,
    username,
    readyTimeout: 8000,
  }
  if (privateKey) connConfig.privateKey = privateKey
  else if (password) connConfig.password = password

  client
    .on('ready', () => {
      clearTimeout(timeout)
      client.end()
      res.json({ success: true, message: '连接成功' })
    })
    .on('error', (err: Error) => {
      clearTimeout(timeout)
      res.json({ success: false, error: err.message })
    })
    .connect(connConfig as Parameters<SshClient['connect']>[0])
})

// 本地终端测试
router.post('/connections/test-local', (req, res) => {
  const { shell, workingDir } = req.body as { shell?: string; workingDir?: string }
  if (!shell) {
    res.status(400).json({ success: false, error: 'Shell 类型不能为空' })
    return
  }

  // 验证工作目录
  if (workingDir) {
    try {
      if (!existsSync(workingDir) || !statSync(workingDir).isDirectory()) {
        res.json({ success: false, error: `工作路径不存在或不是目录: ${workingDir}` })
        return
      }
    } catch {
      res.json({ success: false, error: `无法访问工作路径: ${workingDir}` })
      return
    }
  }

  // Shell 命令映射
  const shellCommands: Record<string, { cmd: string; args: string[] }> = {
    cmd: { cmd: 'cmd.exe', args: ['/C', 'exit', '0'] },
    bash: { cmd: 'bash', args: ['-c', 'exit 0'] },
    powershell: { cmd: 'powershell', args: ['-NoProfile', '-Command', 'exit 0'] },
    powershell7: { cmd: 'pwsh', args: ['-NoProfile', '-Command', 'exit 0'] },
    wsl: { cmd: 'wsl', args: ['--', 'echo', 'ok'] },
    zsh: { cmd: 'zsh', args: ['-c', 'exit 0'] },
    fish: { cmd: 'fish', args: ['-c', 'exit 0'] },
  }

  const entry = shellCommands[shell]
  if (!entry) {
    res.json({ success: false, error: `不支持的 Shell 类型: ${shell}` })
    return
  }

  const timeout = setTimeout(() => {
    child.kill()
    res.json({ success: false, error: '终端启动超时（10s）' })
  }, 10000)

  const child = spawn(entry.cmd, entry.args, { timeout: 10000 })

  child.on('close', (code) => {
    clearTimeout(timeout)
    if (code === 0 || (shell === 'wsl' && code !== null)) {
      res.json({ success: true, message: '终端可用' })
    } else {
      res.json({ success: false, error: `Shell 退出码: ${code}` })
    }
  })

  child.on('error', (err: Error) => {
    clearTimeout(timeout)
    res.json({ success: false, error: `无法启动 ${shell}: ${err.message}` })
  })
})

// 上传 SSH 公钥到远程服务器（ssh-copy-id）
router.post('/connections/:id/upload-key', (req, res) => {
  const { keyId } = req.body as { keyId: string }
  if (!keyId) {
    res.status(400).json({ success: false, error: '请选择要上传的密钥' })
    return
  }

  const raw = connectionRepo.findRawById(req.params.id)
  if (!raw) {
    res.status(404).json({ success: false, error: '连接不存在' })
    return
  }

  const keyData = sshKeyRepo.findById(keyId)
  if (!keyData || !keyData.public_key) {
    res.status(404).json({ success: false, error: '密钥不存在或无公钥' })
    return
  }

  const publicKey = keyData.public_key.trimEnd()
  const client = new SshClient()
  const timeout = setTimeout(() => {
    client.end()
    res.json({ success: false, error: '连接超时（10s）' })
  }, 10000)

  const connConfig: Record<string, unknown> = {
    host: raw.host,
    port: raw.port || 22,
    username: raw.username,
    readyTimeout: 8000,
  }
  if (raw.encrypted_private_key) connConfig.privateKey = decrypt(raw.encrypted_private_key)
  else if (raw.encrypted_password) connConfig.password = decrypt(raw.encrypted_password)

  client
    .on('ready', () => {
      // 安全地追加公钥到 authorized_keys
      const escaped = publicKey.replace(/'/g, "'\\''")
      const cmd = `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${escaped}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`
      client.exec(cmd, (err, stream) => {
        if (err) {
          clearTimeout(timeout)
          client.end()
          res.json({ success: false, error: err.message })
          return
        }
        let stderr = ''
        stream.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
        stream.on('close', (code: number) => {
          clearTimeout(timeout)
          client.end()
          if (code === 0) {
            res.json({ success: true, message: '公钥上传成功' })
          } else {
            res.json({ success: false, error: stderr || `退出码: ${code}` })
          }
        })
      })
    })
    .on('error', (err: Error) => {
      clearTimeout(timeout)
      res.json({ success: false, error: err.message })
    })
    .connect(connConfig as Parameters<SshClient['connect']>[0])
})

export default router
