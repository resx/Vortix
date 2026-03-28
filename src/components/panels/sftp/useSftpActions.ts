/* ── SFTP 操作 handler 集中管理 ── */

import { useCallback, useMemo } from 'react'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpClipboardStore } from '../../../stores/useSftpClipboardStore'
import { useSftpBookmarkStore } from '../../../stores/useSftpBookmarkStore'
import { useUIStore } from '../../../stores/useUIStore'
import { useToastStore } from '../../../stores/useToastStore'
import { useWorkspaceStore } from '../../../stores/useWorkspaceStore'
import { getSession } from '../../../stores/terminalSessionRegistry'
import type { SftpFileEntry } from '../../../types/sftp'
import { useSftpActionsTransfer } from './useSftpActionsTransfer'
import type { UseSftpActionsParams } from './useSftpActions.types'

export function useSftpActions({ sessionId, sftp, targetTabId, openEditor }: UseSftpActionsParams) {
  const addToast = useToastStore(s => s.addToast)
  const getSessionState = useCallback(() => useSftpStore.getState().getSessionState(sessionId), [sessionId])

  const handleNavigate = useCallback((path: string) => {
    useSftpStore.getState().navigateTo(path, sessionId)
    void sftp.listDir(path)
  }, [sessionId, sftp])

  const handleMkdir = useCallback(async () => {
    const name = prompt('新建目录名称')
    if (!name?.trim()) return
    const { currentPath } = getSessionState()
    const newPath = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`
    try {
      await sftp.mkdir(newPath)
      sftp.refresh()
      addToast('success', `目录 ${name.trim()} 创建成功`)
    } catch (err) {
      addToast('error', `创建目录失败: ${(err as Error).message}`)
    }
  }, [getSessionState, sftp, addToast])

  const handleNewFile = useCallback(async () => {
    const name = prompt('新建文件名称')
    if (!name?.trim()) return
    const { currentPath } = getSessionState()
    const newPath = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`
    try {
      await sftp.touch(newPath, false)
      sftp.refresh()
      addToast('success', `文件 ${name.trim()} 创建成功`)
    } catch (err) {
      addToast('error', `创建文件失败: ${(err as Error).message}`)
    }
  }, [getSessionState, sftp, addToast])

  const handleDelete = useCallback(async (path: string, isDir: boolean) => {
    const name = path.split('/').pop() || path
    useUIStore.getState().openConfirmDialog({
      title: '确认删除',
      description: `确定删除 ${name} 吗？`,
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        try {
          await sftp.remove(path, isDir)
          sftp.refresh()
          addToast('success', ` ${name} 已删除`)
        } catch (err) {
          addToast('error', `删除失败: ${(err as Error).message}`)
        }
      },
    })
  }, [sftp, addToast])

  const handleDeleteSelected = useCallback(() => {
    const { selectedPaths, entries } = getSessionState()
    const selected = entries.filter((item) => selectedPaths.has(item.path))
    if (selected.length === 0) return addToast('info', '请选择要删除的项目')
    useUIStore.getState().openConfirmDialog({
      title: '确认批量删除',
      description: `确定删除选中的 ${selected.length} 个项目吗？`,
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        let success = 0
        let failed = 0
        for (const item of selected) {
          try { await sftp.remove(item.path, item.type === 'dir'); success += 1 } catch { failed += 1 }
        }
        sftp.refresh()
        addToast(failed === 0 ? 'success' : 'error', failed === 0 ? `已删除 ${success} 个项目` : `删除完成：成功 ${success}，失败 ${failed}`)
      },
    })
  }, [getSessionState, sftp, addToast])

  const handleRename = useCallback(async (entry: SftpFileEntry) => {
    useSftpStore.getState().setRenamingPath(entry.path, sessionId)
  }, [sessionId])

  const handleRenameSubmit = useCallback(async (oldPath: string, newName: string) => {
    const parentPath = oldPath.replace(/\/[^/]+$/, '') || '/'
    const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`
    try {
      await sftp.rename(oldPath, newPath)
      sftp.refresh()
      addToast('success', `已重命名为 ${newName}`)
    } catch (err) {
      addToast('error', `重命名失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  const handleEdit = useCallback(async (entry: SftpFileEntry) => {
    try { openEditor(entry.path, await sftp.readFile(entry.path)) } catch (err) { addToast('error', `读取文件失败: ${(err as Error).message}`) }
  }, [sftp, openEditor, addToast])

  const handleCopyPath = useCallback((path: string) => {
    void navigator.clipboard.writeText(path).then(() => addToast('success', '路径已复制'))
  }, [addToast])

  const handleCopy = useCallback(() => {
    const { selectedPaths, entries, currentPath } = getSessionState()
    if (selectedPaths.size === 0) return
    const selected = entries.filter(e => selectedPaths.has(e.path))
    useSftpClipboardStore.getState().copy(selected, currentPath)
    addToast('info', `已复制 ${selected.length} 个项目`)
  }, [getSessionState, addToast])

  const handleCut = useCallback(() => {
    const { selectedPaths, entries, currentPath } = getSessionState()
    if (selectedPaths.size === 0) return
    const selected = entries.filter(e => selectedPaths.has(e.path))
    useSftpClipboardStore.getState().cut(selected, currentPath)
    addToast('info', `已剪切 ${selected.length} 个项目`)
  }, [getSessionState, addToast])

  const handlePaste = useCallback(async () => {
    const { items, action, clear } = useSftpClipboardStore.getState()
    if (items.length === 0) return
    const { currentPath } = getSessionState()
    try {
      for (const item of items) {
        const destPath = currentPath === '/' ? `/${item.entry.name}` : `${currentPath}/${item.entry.name}`
        if (action === 'cut') await sftp.rename(item.entry.path, destPath)
        else await sftp.exec(`cp ${item.entry.type === 'dir' ? '-r' : ''} ${item.entry.path} ${destPath}`.trim())
      }
      if (action === 'cut') clear()
      sftp.refresh()
      addToast('success', `已粘贴 ${items.length} 个项目`)
    } catch (err) {
      addToast('error', `粘贴失败: ${(err as Error).message}`)
    }
  }, [getSessionState, sftp, addToast])

  const handleLocate = useCallback(() => {
    const { currentPath } = getSessionState()
    if (!targetTabId) return
    const ws = useWorkspaceStore.getState().workspaces[targetTabId]
    if (!ws?.activePaneId) return
    const session = getSession(ws.activePaneId)
    if (!session?.ws || session.ws.readyState !== WebSocket.OPEN) return addToast('error', '终端未连接')
    session.ws.send(JSON.stringify({ type: 'input', data: `cd ${currentPath.replace(/'/g, "'\\''")}\r` }))
    addToast('success', `终端已定位到 ${currentPath}`)
  }, [getSessionState, targetTabId, addToast])

  const handleChmod = useCallback(async (path: string, mode: string, recursive: boolean) => {
    try { await sftp.chmod(path, mode, recursive); sftp.refresh(); addToast('success', `权限已修改为 ${mode}`) } catch (err) { addToast('error', `修改权限失败: ${(err as Error).message}`) }
  }, [sftp, addToast])

  const handleBookmark = useCallback(() => {
    const { currentPath } = getSessionState()
    const bookmarkStore = useSftpBookmarkStore.getState()
    if (bookmarkStore.has(currentPath)) { bookmarkStore.remove(currentPath); addToast('info', `已取消收藏 ${currentPath}`) }
    else { bookmarkStore.add(currentPath); addToast('success', `已收藏 ${currentPath}`) }
  }, [getSessionState, addToast])

  const transferActions = useSftpActionsTransfer({ sessionId, sftp, addToast, getSessionState })

  return useMemo(() => ({
    handleNavigate,
    handleMkdir,
    handleNewFile,
    handleDelete,
    handleDeleteSelected,
    handleRename,
    handleRenameSubmit,
    handleEdit,
    handleCopyPath,
    handleCopy,
    handleCut,
    handlePaste,
    handleLocate,
    handleChmod,
    handleBookmark,
    ...transferActions,
  }), [
    handleNavigate, handleMkdir, handleNewFile, handleDelete, handleDeleteSelected, handleRename,
    handleRenameSubmit, handleEdit, handleCopyPath, handleCopy, handleCut, handlePaste,
    handleLocate, handleChmod, handleBookmark, transferActions,
  ])
}
