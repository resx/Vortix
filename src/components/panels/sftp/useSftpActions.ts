/* ── SFTP 操作 handler 集中管理 ── */

import { useCallback, useMemo } from 'react'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpClipboardStore } from '../../../stores/useSftpClipboardStore'
import { useSftpBookmarkStore } from '../../../stores/useSftpBookmarkStore'
import { useToastStore } from '../../../stores/useToastStore'
import { useWorkspaceStore } from '../../../stores/useWorkspaceStore'
import { getSession } from '../../../stores/terminalSessionRegistry'
import { pickFiles, uploadFiles } from './SftpUploadHelper'
import { downloadToBrowser } from './SftpDownloadHelper'
import type { SftpFileEntry, ExecResult } from '../../../types/sftp'

interface SftpConnection {
  refresh: () => void
  listDir: (path: string) => Promise<void>
  mkdir: (path: string) => Promise<void>
  rename: (oldPath: string, newPath: string) => Promise<void>
  remove: (path: string, isDir: boolean) => Promise<void>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  chmod: (path: string, mode: string, recursive?: boolean) => Promise<void>
  touch: (path: string, isDir?: boolean) => Promise<void>
  exec: (command: string) => Promise<ExecResult>
  send: (type: string, data?: unknown) => void
}

interface UseSftpActionsParams {
  sftp: SftpConnection
  targetTabId: string | null
  openEditor: (path: string, content: string) => void
}

export function useSftpActions({ sftp, targetTabId, openEditor }: UseSftpActionsParams) {
  const addToast = useToastStore(s => s.addToast)

  const handleNavigate = useCallback((path: string) => {
    useSftpStore.getState().navigateTo(path)
    void sftp.listDir(path)
  }, [sftp])

  const handleUpload = useCallback(async () => {
    const files = await pickFiles(true)
    if (files.length === 0) return
    const { currentPath } = useSftpStore.getState()
    try {
      await uploadFiles(files, {
        send: sftp.send,
        remotePath: currentPath,
        onProgress: (_id, bytes, total) => {
          const pct = Math.round((bytes / total) * 100)
          if (pct % 25 === 0) addToast('info', `上传进度: ${pct}%`)
        },
      })
      sftp.refresh()
      addToast('success', `${files.length} 个文件上传完成`)
    } catch (err) {
      addToast('error', `上传失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  const handleDownload = useCallback(async () => {
    const { selectedPaths, entries } = useSftpStore.getState()
    const selected = entries.filter(e => selectedPaths.has(e.path) && e.type === 'file')
    if (selected.length === 0) {
      addToast('info', '请选择要下载的文件')
      return
    }
    try {
      for (const entry of selected) {
        await downloadToBrowser({
          send: sftp.send,
          remotePath: entry.path,
          fileName: entry.name,
        })
      }
      addToast('success', `${selected.length} 个文件下载完成`)
    } catch (err) {
      addToast('error', `下载失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  const handleMkdir = useCallback(async () => {
    const name = prompt('新建目录名称')
    if (!name?.trim()) return
    const { currentPath } = useSftpStore.getState()
    const newPath = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`
    try {
      await sftp.mkdir(newPath)
      sftp.refresh()
      addToast('success', `目录 ${name.trim()} 创建成功`)
    } catch (err) {
      addToast('error', `创建目录失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  const handleNewFile = useCallback(async () => {
    const name = prompt('新建文件名称')
    if (!name?.trim()) return
    const { currentPath } = useSftpStore.getState()
    const newPath = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`
    try {
      await sftp.touch(newPath, false)
      sftp.refresh()
      addToast('success', `文件 ${name.trim()} 创建成功`)
    } catch (err) {
      addToast('error', `创建文件失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  const handleDelete = useCallback(async (path: string, isDir: boolean) => {
    const name = path.split('/').pop() || path
    if (!confirm(`确定删除 ${name}？${isDir ? '（将递归删除目录内所有内容）' : ''}`)) return
    try {
      await sftp.remove(path, isDir)
      sftp.refresh()
      addToast('success', `${name} 已删除`)
    } catch (err) {
      addToast('error', `删除失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  const handleRename = useCallback(async (entry: SftpFileEntry) => {
    const newName = prompt('重命名', entry.name)
    if (!newName?.trim() || newName.trim() === entry.name) return
    const parentPath = entry.path.replace(/\/[^/]+$/, '') || '/'
    const newPath = parentPath === '/' ? `/${newName.trim()}` : `${parentPath}/${newName.trim()}`
    try {
      await sftp.rename(entry.path, newPath)
      sftp.refresh()
      addToast('success', `已重命名为 ${newName.trim()}`)
    } catch (err) {
      addToast('error', `重命名失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  const handleEdit = useCallback(async (entry: SftpFileEntry) => {
    try {
      const content = await sftp.readFile(entry.path)
      openEditor(entry.path, content)
    } catch (err) {
      addToast('error', `读取文件失败: ${(err as Error).message}`)
    }
  }, [sftp, openEditor, addToast])

  const handleCopyPath = useCallback((path: string) => {
    void navigator.clipboard.writeText(path).then(() => {
      addToast('success', '路径已复制')
    })
  }, [addToast])

  /** 复制选中文件到剪贴板 */
  const handleCopy = useCallback(() => {
    const { selectedPaths, entries, currentPath } = useSftpStore.getState()
    if (selectedPaths.size === 0) return
    const selected = entries.filter(e => selectedPaths.has(e.path))
    useSftpClipboardStore.getState().copy(selected, currentPath)
    addToast('info', `已复制 ${selected.length} 个项目`)
  }, [addToast])

  /** 剪切选中文件到剪贴板 */
  const handleCut = useCallback(() => {
    const { selectedPaths, entries, currentPath } = useSftpStore.getState()
    if (selectedPaths.size === 0) return
    const selected = entries.filter(e => selectedPaths.has(e.path))
    useSftpClipboardStore.getState().cut(selected, currentPath)
    addToast('info', `已剪切 ${selected.length} 个项目`)
  }, [addToast])

  /** 粘贴剪贴板内容到当前目录 */
  const handlePaste = useCallback(async () => {
    const { items, action, clear } = useSftpClipboardStore.getState()
    if (items.length === 0) return
    const { currentPath } = useSftpStore.getState()
    try {
      for (const item of items) {
        const destPath = currentPath === '/'
          ? `/${item.entry.name}`
          : `${currentPath}/${item.entry.name}`
        if (action === 'cut') {
          await sftp.rename(item.entry.path, destPath)
        } else {
          const flag = item.entry.type === 'dir' ? '-r' : ''
          await sftp.exec(`cp ${flag} ${item.entry.path} ${destPath}`.trim())
        }
      }
      if (action === 'cut') clear()
      sftp.refresh()
      addToast('success', `已粘贴 ${items.length} 个项目`)
    } catch (err) {
      addToast('error', `粘贴失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  /** 在终端中定位到当前 SFTP 目录 */
  const handleLocate = useCallback(() => {
    const { currentPath } = useSftpStore.getState()
    if (!targetTabId) return
    const ws = useWorkspaceStore.getState().workspaces[targetTabId]
    if (!ws?.activePaneId) return
    const session = getSession(ws.activePaneId)
    if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) {
      addToast('error', '终端未连接')
      return
    }
    const cmd = `cd ${currentPath.replace(/'/g, "'\\''")}\r`
    session.ws.send(JSON.stringify({ type: 'input', data: cmd }))
    addToast('success', `终端已定位到 ${currentPath}`)
  }, [targetTabId, addToast])

  /** 修改权限 */
  const handleChmod = useCallback(async (path: string, mode: string, recursive: boolean) => {
    try {
      await sftp.chmod(path, mode, recursive)
      sftp.refresh()
      addToast('success', `权限已修改为 ${mode}`)
    } catch (err) {
      addToast('error', `修改权限失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  /** 收藏/取消收藏当前路径 */
  const handleBookmark = useCallback(() => {
    const { currentPath } = useSftpStore.getState()
    const store = useSftpBookmarkStore.getState()
    if (store.has(currentPath)) {
      store.remove(currentPath)
      addToast('info', `已取消收藏 ${currentPath}`)
    } else {
      store.add(currentPath)
      addToast('success', `已收藏 ${currentPath}`)
    }
  }, [addToast])

  return useMemo(() => ({
    handleNavigate,
    handleUpload,
    handleDownload,
    handleMkdir,
    handleNewFile,
    handleDelete,
    handleRename,
    handleEdit,
    handleCopyPath,
    handleCopy,
    handleCut,
    handlePaste,
    handleLocate,
    handleChmod,
    handleBookmark,
  }), [
    handleNavigate, handleUpload, handleDownload, handleMkdir, handleNewFile,
    handleDelete, handleRename, handleEdit, handleCopyPath,
    handleCopy, handleCut, handlePaste, handleLocate, handleChmod, handleBookmark,
  ])
}
