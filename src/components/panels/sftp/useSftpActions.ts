/* ── SFTP 操作 handler 集中管理 ── */

import { useCallback, useMemo } from 'react'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpClipboardStore } from '../../../stores/useSftpClipboardStore'
import { useSftpBookmarkStore } from '../../../stores/useSftpBookmarkStore'
import { useUIStore } from '../../../stores/useUIStore'
import { useToastStore } from '../../../stores/useToastStore'
import { useWorkspaceStore } from '../../../stores/useWorkspaceStore'
import { getSession } from '../../../stores/terminalSessionRegistry'
import { pickFiles, pickFolder } from './SftpUploadHelper'
import { uploadFiles, downloadFile, saveDownload, saveDownloadTo, saveAndOpenLocal } from '../../../services/transfer-engine'
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
      await uploadFiles(sftp.send, files, currentPath)
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
    const enqueueDownload = () => {
      for (const entry of selected) {
        const { transferId, promise } = downloadFile(sftp.send, entry.path, entry.name, entry.size)
        // 下载完成后自动保存到 ~/Downloads/vortix-download/
        promise.then(() => saveDownload(transferId)).catch(() => {/* store 已记录错误 */})
      }
      addToast('info', `${selected.length} 个文件已加入传输队列`)
    }
    if (selected.length > 1) {
      useUIStore.getState().openConfirmDialog({
        title: '确认批量下载',
        description: `将 ${selected.length} 个文件加入下载队列，是否继续？`,
        confirmText: '加入队列',
        onConfirm: enqueueDownload,
      })
      return
    }
    enqueueDownload()
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
    const { selectedPaths, entries } = useSftpStore.getState()
    const selected = entries.filter((item) => selectedPaths.has(item.path))
    if (selected.length === 0) {
      addToast('info', '请选择要删除的项目')
      return
    }

    useUIStore.getState().openConfirmDialog({
      title: '确认批量删除',
      description: `确定删除选中的 ${selected.length} 个项目吗？`,
      confirmText: '确认删除',
      danger: true,
      onConfirm: async () => {
        let success = 0
        let failed = 0
        for (const item of selected) {
          try {
            await sftp.remove(item.path, item.type === 'dir')
            success += 1
          } catch {
            failed += 1
          }
        }
        sftp.refresh()
        if (failed === 0) {
          addToast('success', `已删除 ${success} 个项目`)
        } else {
          addToast('error', `删除完成：成功 ${success}，失败 ${failed}`)
        }
      },
    })
  }, [sftp, addToast])

  const handleRename = useCallback(async (entry: SftpFileEntry) => {
    useSftpStore.getState().setRenamingPath(entry.path)
  }, [])

  /** 执行重命名（由 SftpInlineRename 调用） */
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

  /** 本地打开：下载文件到本地磁盘，然后用系统默认程序打开 */
  const handleLocalOpen = useCallback(async (entry: SftpFileEntry) => {
    if (entry.type === 'dir') return
    try {
      const { transferId, promise } = downloadFile(sftp.send, entry.path, entry.name, entry.size)
      await promise
      await saveAndOpenLocal(transferId)
    } catch (err) {
      addToast('error', `打开失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  /** 下载至：先选择保存路径，再开始下载 */
  const handleDownloadTo = useCallback(async (entry: SftpFileEntry) => {
    if (entry.type === 'dir') return
    try {
      const { transferId, promise } = downloadFile(sftp.send, entry.path, entry.name, entry.size)
      await promise
      await saveDownloadTo(transferId)
    } catch (err) {
      addToast('error', `下载失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  /** 选择文件夹上传 */
  const handleUploadFolder = useCallback(async () => {
    const files = await pickFolder()
    if (files.length === 0) return
    const { currentPath } = useSftpStore.getState()
    try {
      await uploadFiles(sftp.send, files, currentPath)
      sftp.refresh()
      addToast('success', `文件夹上传完成 (${files.length} 个文件)`)
    } catch (err) {
      addToast('error', `上传失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  /** 压缩选中文件/目录 */
  const handleCompress = useCallback(async () => {
    const { selectedPaths, entries, currentPath } = useSftpStore.getState()
    const selected = entries.filter(e => selectedPaths.has(e.path))
    if (selected.length === 0) {
      addToast('info', '请选择要压缩的文件')
      return
    }

    const runCompress = async () => {
      const archiveName = prompt('压缩文件名', selected.length === 1 ? `${selected[0].name}.tar.gz` : 'archive.tar.gz')
      if (!archiveName?.trim()) return
      const names = selected.map(e => e.name).join(' ')
      try {
        const result = await sftp.exec(`cd "${currentPath}" && tar -czf "${archiveName.trim()}" ${names}`)
        if (result.code !== 0) throw new Error(result.stderr || '压缩失败')
        sftp.refresh()
        addToast('success', `压缩完成：${selected.length} 项 -> ${archiveName.trim()}`)
      } catch (err) {
        addToast('error', `压缩失败: ${(err as Error).message}`)
      }
    }

    if (selected.length > 1) {
      useUIStore.getState().openConfirmDialog({
        title: '确认批量压缩',
        description: `将压缩 ${selected.length} 个项目，是否继续？`,
        confirmText: '继续压缩',
        onConfirm: () => { void runCompress() },
      })
      return
    }
    await runCompress()
  }, [sftp, addToast])

  /** 解压缩 */
  const handleDecompress = useCallback(async (entry: SftpFileEntry) => {
    const { currentPath } = useSftpStore.getState()
    const name = entry.name
    const baseName = name.replace(/\.(tar\.gz|tgz|tar\.bz2|tar\.xz|zip|gz|bz2|xz)$/i, '')
    const destDir = `${currentPath}/${baseName}`
    let cmd: string
    if (/\.zip$/i.test(name)) {
      cmd = `cd "${currentPath}" && mkdir -p "${baseName}" && unzip -o "${name}" -d "${baseName}"`
    } else if (/\.(tar\.gz|tgz|tar\.bz2|tar\.xz|tar)$/i.test(name)) {
      cmd = `cd "${currentPath}" && mkdir -p "${baseName}" && tar -xf "${name}" -C "${baseName}"`
    } else if (/\.gz$/i.test(name)) {
      cmd = `cd "${currentPath}" && gunzip -k "${name}"`
    } else {
      addToast('error', '不支持的压缩格式')
      return
    }
    try {
      const result = await sftp.exec(cmd)
      if (result.code !== 0) throw new Error(result.stderr || '解压失败')
      sftp.refresh()
      addToast('success', `已解压到 ${destDir}`)
    } catch (err) {
      addToast('error', `解压失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast])

  /** SCP 下载（通过 exec scp 命令） */
  const handleScpDownload = useCallback(() => {
    addToast('info', 'SCP 传输功能开发中')
  }, [addToast])

  /** SCP 上传（通过 exec scp 命令） */
  const handleScpUpload = useCallback(() => {
    addToast('info', 'SCP 传输功能开发中')
  }, [addToast])

  return useMemo(() => ({
    handleNavigate,
    handleUpload,
    handleDownload,
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
    handleLocalOpen,
    handleDownloadTo,
    handleUploadFolder,
    handleCompress,
    handleDecompress,
    handleScpDownload,
    handleScpUpload,
  }), [
    handleNavigate, handleUpload, handleDownload, handleMkdir, handleNewFile,
    handleDelete, handleDeleteSelected, handleRename, handleRenameSubmit, handleEdit, handleCopyPath,
    handleCopy, handleCut, handlePaste, handleLocate, handleChmod, handleBookmark,
    handleLocalOpen, handleDownloadTo, handleUploadFolder,
    handleCompress, handleDecompress, handleScpDownload, handleScpUpload,
  ])
}

