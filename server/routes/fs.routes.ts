/* ── 文件系统路由 ── */

import { Router } from 'express'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execFile } from 'child_process'

const router = Router()

// 列出指定路径下的子目录
router.get('/fs/list-dirs', (req, res) => {
  const rawPath = (req.query.path as string) || ''
  const basePath = rawPath || homedir()

  try {
    const entries = readdirSync(basePath, { withFileTypes: true })
    const dirs = entries
      .filter(e => {
        if (!e.isDirectory()) return false
        if (e.name.startsWith('.') || e.name.startsWith('$')) return false
        try { statSync(join(basePath, e.name)); return true } catch { return false }
      })
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

    res.json({ success: true, data: { path: basePath, dirs } })
  } catch (err) {
    res.json({ success: false, error: `无法读取目录: ${(err as Error).message}` })
  }
})

// 调用系统原生文件夹选择对话框
router.post('/fs/pick-dir', (req, res) => {
  const { initialDir } = req.body as { initialDir?: string }

  // PowerShell 脚本：打开 FolderBrowserDialog
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = '选择工作目录'
$d.ShowNewFolderButton = $true
${initialDir ? `$d.SelectedPath = '${initialDir.replace(/'/g, "''")}'` : ''}
if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $d.SelectedPath
} else {
  Write-Output ''
}
`.trim()

  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 60000 }, (err, stdout) => {
    if (err) {
      res.json({ success: false, error: err.message })
      return
    }
    const selected = stdout.trim()
    if (selected) {
      res.json({ success: true, data: { path: selected } })
    } else {
      res.json({ success: true, data: { path: null } })
    }
  })
})

export default router
