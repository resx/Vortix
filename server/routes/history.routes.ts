/* ── 命令历史路由 ── */

import { Router } from 'express'
import * as historyRepo from '../repositories/history.repository.js'

const router = Router()

// 获取连接的命令历史
router.get('/history/:connectionId', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100
  const history = historyRepo.findByConnection(req.params.connectionId, limit)
  res.json({ success: true, data: history })
})

// 添加命令历史
router.post('/history', (req, res) => {
  const { connection_id, command } = req.body
  if (!connection_id || !command) {
    res.status(400).json({ success: false, error: '连接 ID 和命令不能为空' })
    return
  }
  const entry = historyRepo.create(connection_id, command)
  res.status(201).json({ success: true, data: entry })
})

// 清除连接的所有命令历史
router.delete('/history/:connectionId', (req, res) => {
  const count = historyRepo.removeByConnection(req.params.connectionId)
  res.json({ success: true, data: { deleted: count } })
})

export default router
