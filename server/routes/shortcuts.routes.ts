/* ── 快捷命令路由 ── */

import { Router } from 'express'
import * as shortcutRepo from '../repositories/shortcut.repository.js'
import type { ApiResponse, Shortcut } from '../types/index.js'

const router = Router()

// GET /shortcuts — 列表
router.get('/shortcuts', (_req, res) => {
  const data = shortcutRepo.findAll()
  const body: ApiResponse<Shortcut[]> = { success: true, data }
  res.json(body)
})

// POST /shortcuts — 创建
router.post('/shortcuts', (req, res) => {
  const { name, command, remark, sort_order } = req.body
  if (!name || !command) {
    const body: ApiResponse = { success: false, error: 'name 和 command 为必填项' }
    res.status(400).json(body)
    return
  }
  if (typeof name !== 'string' || name.length > 255) {
    res.status(400).json({ success: false, error: 'name 长度不能超过 255' })
    return
  }
  if (typeof command !== 'string' || command.length > 2000) {
    res.status(400).json({ success: false, error: 'command 长度不能超过 2000' })
    return
  }
  const data = shortcutRepo.create({ name, command, remark, sort_order })
  const body: ApiResponse<Shortcut> = { success: true, data }
  res.status(201).json(body)
})

// PUT /shortcuts/:id — 更新
router.put('/shortcuts/:id', (req, res) => {
  const data = shortcutRepo.update(req.params.id, req.body)
  if (!data) {
    const body: ApiResponse = { success: false, error: '快捷命令不存在' }
    res.status(404).json(body)
    return
  }
  const body: ApiResponse<Shortcut> = { success: true, data }
  res.json(body)
})

// DELETE /shortcuts/:id — 删除
router.delete('/shortcuts/:id', (req, res) => {
  const ok = shortcutRepo.remove(req.params.id)
  if (!ok) {
    const body: ApiResponse = { success: false, error: '快捷命令不存在' }
    res.status(404).json(body)
    return
  }
  const body: ApiResponse = { success: true }
  res.json(body)
})

export default router
