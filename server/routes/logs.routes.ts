/* ── 日志相关路由 ── */

import { Router } from 'express'
import * as logRepo from '../repositories/log.repository.js'

const router = Router()

/** GET /api/recent-connections — 最近连接列表 */
router.get('/recent-connections', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 15, 50)
  const data = logRepo.findRecentConnections(limit)
  res.json({ success: true, data })
})

/** POST /api/maintenance/cleanup — 清除孤立数据 */
router.post('/maintenance/cleanup', (_req, res) => {
  const deleted = logRepo.cleanupOrphanData()
  res.json({ success: true, data: { deleted } })
})

export default router
