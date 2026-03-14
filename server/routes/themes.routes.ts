/* ── 自定义主题 CRUD + 导入/导出 路由 ── */

import { Router } from 'express'
import * as themeRepo from '../repositories/theme.repository.js'
import { importTheme, exportTheme } from '../services/theme-import.service.js'
import type { ApiResponse } from '../types/index.js'

const router = Router()

/* GET /themes -- 获取全部自定义主题 */
router.get('/themes', (_req, res) => {
  const themes = themeRepo.findAll()
  const body: ApiResponse = { success: true, data: themes }
  res.json(body)
})

/* GET /themes/:id -- 获取单个主题 */
router.get('/themes/:id', (req, res) => {
  const theme = themeRepo.findById(req.params.id)
  if (!theme) {
    res.status(404).json({ success: false, error: '主题不存在' })
    return
  }
  const body: ApiResponse = { success: true, data: theme }
  res.json(body)
})

/* POST /themes -- 创建自定义主题 */
router.post('/themes', (req, res) => {
  const { name, mode, terminal, highlights, ui, author } = req.body
  if (!name || !mode || !terminal || !highlights) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }
  const theme = themeRepo.create({ name, mode, terminal, highlights, ui, author })
  const body: ApiResponse = { success: true, data: theme }
  res.status(201).json(body)
})

/* PUT /themes/:id -- 更新自定义主题 */
router.put('/themes/:id', (req, res) => {
  const theme = themeRepo.update(req.params.id, req.body)
  if (!theme) {
    res.status(404).json({ success: false, error: '主题不存在' })
    return
  }
  const body: ApiResponse = { success: true, data: theme }
  res.json(body)
})

/* DELETE /themes/:id -- 删除自定义主题 */
router.delete('/themes/:id', (req, res) => {
  const ok = themeRepo.remove(req.params.id)
  if (!ok) {
    res.status(404).json({ success: false, error: '主题不存在' })
    return
  }
  res.json({ success: true })
})

/* POST /themes/import -- 导入主题 */
router.post('/themes/import', (req, res) => {
  const { raw } = req.body
  if (!raw || typeof raw !== 'string') {
    res.status(400).json({ success: false, error: '缺少 raw 字段' })
    return
  }
  const result = importTheme(raw)
  if (result.themes.length === 0) {
    res.status(400).json({ success: false, error: result.errors.join('; ') || '未解析到主题' })
    return
  }
  // 逐个创建
  const created = result.themes.map(t =>
    themeRepo.create({
      name: t.name,
      mode: t.mode,
      terminal: t.terminal,
      highlights: t.highlights,
      ui: t.ui,
      author: t.author,
    }),
  )
  const body: ApiResponse = { success: true, data: { format: result.format, themes: created, errors: result.errors } }
  res.status(201).json(body)
})

/* GET /themes/:id/export -- 导出主题 */
router.get('/themes/:id/export', (req, res) => {
  const theme = themeRepo.findById(req.params.id)
  if (!theme) {
    res.status(404).json({ success: false, error: '主题不存在' })
    return
  }
  const json = exportTheme(theme)
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Content-Disposition', `attachment; filename="${theme.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.vortix-theme.json"`)
  res.send(json)
})

export default router
