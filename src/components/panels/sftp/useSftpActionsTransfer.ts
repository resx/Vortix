import { useCallback } from 'react'
import type { SftpSessionId } from '../../../stores/useSftpStore'
import { useUIStore } from '../../../stores/useUIStore'
import { pickFiles, pickFolder } from './SftpUploadHelper'
import { uploadFiles, downloadFile, saveDownload, saveDownloadTo, saveAndOpenLocal } from '../../../services/transfer-engine'
import type { SftpFileEntry } from '../../../types/sftp'
import type { SftpConnection } from './useSftpActions.types'
import type { ToastType } from '../../../stores/useToastStore'

interface TransferDeps {
  sessionId: SftpSessionId
  sftp: SftpConnection
  addToast: (kind: ToastType, message: string) => void
  getSessionState: () => {
    currentPath: string
    selectedPaths: Set<string>
    entries: SftpFileEntry[]
  }
}

export function useSftpActionsTransfer({ sessionId, sftp, addToast, getSessionState }: TransferDeps) {
  const handleUpload = useCallback(async () => {
    const files = await pickFiles(true)
    if (files.length === 0) return
    const { currentPath } = getSessionState()
    try {
      await uploadFiles(sftp.send, files, currentPath, sessionId)
      sftp.refresh()
      addToast('success', `${files.length} 个文件上传完成`)
    } catch (err) {
      addToast('error', `上传失败: ${(err as Error).message}`)
    }
  }, [getSessionState, sftp, addToast, sessionId])

  const handleDownload = useCallback(async () => {
    const { selectedPaths, entries } = getSessionState()
    const selected = entries.filter(e => selectedPaths.has(e.path) && e.type === 'file')
    if (selected.length === 0) return addToast('info', '请选择要下载的文件')
    const enqueueDownload = () => {
      for (const entry of selected) {
        const { transferId, promise } = downloadFile(sftp.send, entry.path, entry.name, entry.size, sessionId)
        promise.then(() => saveDownload(transferId)).catch(() => { /* noop */ })
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
  }, [getSessionState, sftp, addToast, sessionId])

  const handleLocalOpen = useCallback(async (entry: SftpFileEntry) => {
    if (entry.type === 'dir') return
    try {
      const { transferId, promise } = downloadFile(sftp.send, entry.path, entry.name, entry.size, sessionId)
      await promise
      await saveAndOpenLocal(transferId)
    } catch (err) {
      addToast('error', `打开失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast, sessionId])

  const handleDownloadTo = useCallback(async (entry: SftpFileEntry) => {
    if (entry.type === 'dir') return
    try {
      const { transferId, promise } = downloadFile(sftp.send, entry.path, entry.name, entry.size, sessionId)
      await promise
      await saveDownloadTo(transferId)
    } catch (err) {
      addToast('error', `下载失败: ${(err as Error).message}`)
    }
  }, [sftp, addToast, sessionId])

  const handleUploadFolder = useCallback(async () => {
    const files = await pickFolder()
    if (files.length === 0) return
    const { currentPath } = getSessionState()
    try {
      await uploadFiles(sftp.send, files, currentPath, sessionId)
      sftp.refresh()
      addToast('success', `文件夹上传完成 (${files.length} 个文件)`)
    } catch (err) {
      addToast('error', `上传失败: ${(err as Error).message}`)
    }
  }, [getSessionState, sftp, addToast, sessionId])

  const handleCompress = useCallback(async () => {
    const { selectedPaths, entries, currentPath } = getSessionState()
    const selected = entries.filter(e => selectedPaths.has(e.path))
    if (selected.length === 0) return addToast('info', '请选择要压缩的文件')

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
  }, [getSessionState, sftp, addToast])

  const handleDecompress = useCallback(async (entry: SftpFileEntry) => {
    const { currentPath } = getSessionState()
    const name = entry.name
    const baseName = name.replace(/\.(tar\.gz|tgz|tar\.bz2|tar\.xz|zip|gz|bz2|xz)$/i, '')
    const destDir = `${currentPath}/${baseName}`
    let cmd: string
    if (/\.zip$/i.test(name)) cmd = `cd "${currentPath}" && mkdir -p "${baseName}" && unzip -o "${name}" -d "${baseName}"`
    else if (/\.(tar\.gz|tgz|tar\.bz2|tar\.xz|tar)$/i.test(name)) cmd = `cd "${currentPath}" && mkdir -p "${baseName}" && tar -xf "${name}" -C "${baseName}"`
    else if (/\.gz$/i.test(name)) cmd = `cd "${currentPath}" && gunzip -k "${name}"`
    else return addToast('error', '不支持的压缩格式')
    try {
      const result = await sftp.exec(cmd)
      if (result.code !== 0) throw new Error(result.stderr || '解压失败')
      sftp.refresh()
      addToast('success', `已解压到 ${destDir}`)
    } catch (err) {
      addToast('error', `解压失败: ${(err as Error).message}`)
    }
  }, [getSessionState, sftp, addToast])

  const handleScpDownload = useCallback(() => addToast('info', 'SCP 传输功能开发中'), [addToast])
  const handleScpUpload = useCallback(() => addToast('info', 'SCP 传输功能开发中'), [addToast])

  return {
    handleUpload,
    handleDownload,
    handleLocalOpen,
    handleDownloadTo,
    handleUploadFolder,
    handleCompress,
    handleDecompress,
    handleScpDownload,
    handleScpUpload,
  }
}
