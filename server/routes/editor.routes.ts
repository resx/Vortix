/* ── 外部编辑器 API ── */
/* 下载远程文件到本地临时目录，启动外部编辑器 */

import { Router } from 'express'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const router = Router()

/** 获取临时目录 */
function getTempDir(): string {
  const dir = path.join(os.tmpdir(), 'vortix-editor')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** 获取编辑器命令 */
function getCommand(editorType: string, filePath: string, customCommand?: string): string {
  switch (editorType) {
    case 'system':
      return process.platform === 'win32'
        ? `start "" "${filePath}"`
        : `xdg-open "${filePath}"`
    case 'vscode':
      return `code "${filePath}"`
    case 'notepad++':
      return `"C:\\Program Files\\Notepad++\\notepad++.exe" "${filePath}"`
    case 'sublime':
      return process.platform === 'win32'
        ? `"C:\\Program Files\\Sublime Text\\subl.exe" "${filePath}"`
        : `subl "${filePath}"`
    case 'custom':
      return customCommand
        ? customCommand.replace(/\{file\}/g, filePath)
        : `start "" "${filePath}"`
    default:
      return `start "" "${filePath}"`
  }
}

// POST /api/editor/open — 启动外部编辑器（预留，需要 SFTP 下载临时文件）
router.post('/open', (req, res) => {
  const { editorType, customCommand, localPath } = req.body as {
    editorType: string
    customCommand?: string
    localPath?: string
  }

  if (!editorType) {
    res.status(400).json({ success: false, error: '缺少编辑器类型' })
    return
  }

  if (editorType === 'builtin') {
    res.status(400).json({ success: false, error: '内置编辑器不需要调用此 API' })
    return
  }

  // 如果提供了本地路径，直接打开
  if (localPath) {
    const cmd = getCommand(editorType, localPath, customCommand)
    exec(cmd, (err) => {
      if (err) {
        res.status(500).json({ success: false, error: `启动编辑器失败: ${err.message}` })
        return
      }
      res.json({ success: true })
    })
    return
  }

  // 暂不支持直接从远程路径打开（需要先通过 SFTP 下载）
  res.status(400).json({ success: false, error: '请先下载文件到本地' })
})

// GET /api/editor/temp-dir — 获取临时目录路径
router.get('/temp-dir', (_req, res) => {
  res.json({ success: true, data: { path: getTempDir() } })
})

export default router
