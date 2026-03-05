/* ── 连接路由 ── */

import { Router } from 'express'
import * as connectionRepo from '../repositories/connection.repository.js'
import { encrypt, decrypt } from '../services/crypto.service.js'

const router = Router()

// 获取所有连接
router.get('/connections', (req, res) => {
  const folderId = req.query.folder_id as string | undefined
  const connections = connectionRepo.findAll(folderId)
  res.json({ success: true, data: connections })
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
  if (!name || !host || !username) {
    res.status(400).json({ success: false, error: '名称、主机和用户名不能为空' })
    return
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

export default router
