/* ── 连接预设路由 ── */

import { Router } from 'express'
import * as presetRepo from '../repositories/preset.repository.js'

const router = Router()

// 获取所有预设（不含密码）
router.get('/presets', (_req, res) => {
  const presets = presetRepo.findAll()
  res.json({ success: true, data: presets })
})

// 获取预设凭据（含解密密码）
router.get('/presets/:id/credential', (req, res) => {
  const credential = presetRepo.getCredential(req.params.id)
  if (!credential) {
    res.status(404).json({ success: false, error: '预设不存在' })
    return
  }
  res.json({ success: true, data: credential })
})

// 创建预设
router.post('/presets', (req, res) => {
  const { name, username, password, remark } = req.body
  if (!name || !username || !password) {
    res.status(400).json({ success: false, error: '名称、用户名和密码不能为空' })
    return
  }
  if (typeof name !== 'string' || name.length > 255) {
    res.status(400).json({ success: false, error: '名称长度不能超过 255' })
    return
  }
  const preset = presetRepo.create({ name, username, password, remark })
  res.status(201).json({ success: true, data: preset })
})

// 更新预设
router.put('/presets/:id', (req, res) => {
  const { name, username, password, remark } = req.body
  const preset = presetRepo.update(req.params.id, { name, username, password, remark })
  if (!preset) {
    res.status(404).json({ success: false, error: '预设不存在' })
    return
  }
  res.json({ success: true, data: preset })
})

// 删除预设
router.delete('/presets/:id', (req, res) => {
  const deleted = presetRepo.remove(req.params.id)
  if (!deleted) {
    res.status(404).json({ success: false, error: '预设不存在' })
    return
  }
  res.json({ success: true })
})

export default router
