/* ── 文件夹路由 ── */

import { Router } from 'express'
import * as folderRepo from '../repositories/folder.repository.js'

const router = Router()

// 获取所有文件夹
router.get('/folders', (_req, res) => {
  const folders = folderRepo.findAll()
  res.json({ success: true, data: folders })
})

// 创建文件夹
router.post('/folders', (req, res) => {
  const { name, parent_id, sort_order } = req.body
  if (!name) {
    res.status(400).json({ success: false, error: '文件夹名称不能为空' })
    return
  }
  if (typeof name !== 'string' || name.length > 255) {
    res.status(400).json({ success: false, error: '文件夹名称长度不能超过 255' })
    return
  }
  const folder = folderRepo.create({ name, parent_id, sort_order })
  res.status(201).json({ success: true, data: folder })
})

// 更新文件夹
router.put('/folders/:id', (req, res) => {
  const { id } = req.params
  const folder = folderRepo.update(id, req.body)
  if (!folder) {
    res.status(404).json({ success: false, error: '文件夹不存在' })
    return
  }
  res.json({ success: true, data: folder })
})

// 删除文件夹
router.delete('/folders/:id', (req, res) => {
  const { id } = req.params
  const deleted = folderRepo.remove(id)
  if (!deleted) {
    res.status(404).json({ success: false, error: '文件夹不存在' })
    return
  }
  res.json({ success: true })
})

export default router
