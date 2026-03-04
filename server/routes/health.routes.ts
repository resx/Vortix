/* ── 健康检查路由 ── */

import { Router } from 'express'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } })
})

export default router
