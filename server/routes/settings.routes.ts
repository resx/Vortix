/* ── 设置路由 ── */

import { Router } from 'express'
import * as settingsRepo from '../repositories/settings.repository.js'

const router = Router()

// 获取所有设置
router.get('/settings', (_req, res) => {
  const settings = settingsRepo.getAll()
  res.json({ success: true, data: settings })
})

// 批量更新设置
router.put('/settings', (req, res) => {
  const settings = req.body
  if (!settings || typeof settings !== 'object') {
    res.status(400).json({ success: false, error: '请求体必须是一个对象' })
    return
  }
  settingsRepo.setMany(settings)
  res.json({ success: true })
})

// 重置所有设置
router.post('/settings/reset', (_req, res) => {
  settingsRepo.resetAll()
  res.json({ success: true })
})

export default router
