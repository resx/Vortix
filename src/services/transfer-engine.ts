/* ── 统一传输引擎 ── */
/* 桥接 useTransferStore 和 SFTP WebSocket，处理分块上传/下载 */

import { useTransferStore } from '../stores/useTransferStore'
import { useSftpStore } from '../stores/useSftpStore'
import { useSettingsStore } from '../stores/useSettingsStore'

const CHUNK_SIZE = 64 * 1024
const PROGRESS_THROTTLE = 200

type SendFn = (type: string, data?: unknown) => void

/** 速度计算：滑动窗口平均 */
class SpeedTracker {
  private samples: { bytes: number; time: number }[] = []
  push(bytes: number): number {
    this.samples.push({ bytes, time: Date.now() })
    if (this.samples.length > 5) this.samples.shift()
    if (this.samples.length < 2) return 0
    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    const elapsed = (last.time - first.time) / 1000
    if (elapsed <= 0) return 0
    return this.samples.slice(1).reduce((s, x) => s + x.bytes, 0) / elapsed
  }
}

export function generateTransferId(): string {
  return `tf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 安全 base64 编码 */
function uint8ToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/* ── 节流进度 ── */
const lastUpdate = new Map<string, number>()
function throttledProgress(id: string, bytes: number, speed: number) {
  const now = Date.now()
  if (now - (lastUpdate.get(id) ?? 0) < PROGRESS_THROTTLE) return
  lastUpdate.set(id, now)
  useTransferStore.getState().updateProgress(id, bytes, speed)
}

/** 获取当前连接信息 */
function getConnInfo() {
  const { connectionId, connectionName } = useSftpStore.getState()
  return { connectionId, connectionName }
}
/* ── 上传 ── */

export async function uploadFile(
  send: SendFn,
  file: File,
  remotePath: string,
): Promise<string> {
  const store = useTransferStore.getState()
  const { connectionId, connectionName } = getConnInfo()
  const transferId = generateTransferId()
  const fullPath = remotePath.endsWith('/')
    ? `${remotePath}${file.name}`
    : `${remotePath}/${file.name}`

  store.enqueue({
    id: transferId,
    type: 'upload',
    fileName: file.name,
    remotePath: fullPath,
    fileSize: file.size,
    connectionId,
    connectionName,
  })

  const tracker = new SpeedTracker()
  send('sftp-upload-start', {
    transferId,
    remotePath: fullPath,
    fileName: file.name,
    fileSize: file.size,
  })
  store.updateStatus(transferId, 'active')

  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let offset = 0

    while (offset < bytes.length) {
      const task = useTransferStore.getState().tasks.find(t => t.id === transferId)
      if (!task || task.status === 'cancelled') return transferId
      if (task.status === 'paused') {
        await new Promise(r => setTimeout(r, 500))
        continue
      }
      const end = Math.min(offset + CHUNK_SIZE, bytes.length)
      const chunk = bytes.slice(offset, end)
      send('sftp-upload-chunk', { transferId, chunk: uint8ToBase64(chunk), offset })
      offset = end
      throttledProgress(transferId, offset, tracker.push(chunk.length))
    }

    send('sftp-upload-end', { transferId })
    useTransferStore.getState().updateProgress(transferId, offset, 0)
    useTransferStore.getState().updateStatus(transferId, 'completed')
  } catch (err) {
    useTransferStore.getState().updateStatus(transferId, 'failed', (err as Error).message)
  } finally {
    lastUpdate.delete(transferId)
  }
  return transferId
}

export async function uploadFiles(
  send: SendFn,
  files: File[],
  remotePath: string,
): Promise<string[]> {
  const ids: string[] = []
  for (const file of files) ids.push(await uploadFile(send, file, remotePath))
  return ids
}
/* ── 下载 ── */

interface DownloadSession {
  chunks: Uint8Array[]
  totalBytes: number
  tracker: SpeedTracker
  resolve: (blob: Blob) => void
  reject: (err: Error) => void
}

const dlSessions = new Map<string, DownloadSession>()
/** 已完成下载的 Blob 暂存（供后续保存） */
const completedBlobs = new Map<string, { blob: Blob; fileName: string }>()

/** 发起下载，返回 Blob Promise */
export function downloadFile(
  send: SendFn,
  remotePath: string,
  fileName: string,
  fileSize: number,
): { transferId: string; promise: Promise<Blob> } {
  const store = useTransferStore.getState()
  const { connectionId, connectionName } = getConnInfo()
  const transferId = generateTransferId()

  store.enqueue({
    id: transferId,
    type: 'download',
    fileName,
    remotePath,
    fileSize,
    connectionId,
    connectionName,
  })
  store.updateStatus(transferId, 'active')

  const promise = new Promise<Blob>((resolve, reject) => {
    dlSessions.set(transferId, {
      chunks: [],
      totalBytes: 0,
      tracker: new SpeedTracker(),
      resolve,
      reject,
    })
  })

  send('sftp-download-start', { transferId, remotePath })
  return { transferId, promise }
}

/** 处理下载 chunk（由 useSftpConnection 路由） */
export function handleDownloadChunk(data: {
  transferId: string
  chunk: string
  bytesTransferred: number
  fileSize: number
  fileName: string
}): void {
  const session = dlSessions.get(data.transferId)
  if (!session) return
  const task = useTransferStore.getState().tasks.find(t => t.id === data.transferId)
  if (!task || task.status === 'cancelled') {
    dlSessions.delete(data.transferId)
    lastUpdate.delete(data.transferId)
    return
  }
  const binary = atob(data.chunk)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  session.chunks.push(bytes)
  session.totalBytes = data.bytesTransferred
  throttledProgress(data.transferId, data.bytesTransferred, session.tracker.push(bytes.length))
}
/** 处理下载完成 */
export function handleDownloadComplete(data: { transferId: string }): void {
  const session = dlSessions.get(data.transferId)
  if (!session) return
  const blob = new Blob(session.chunks as BlobPart[])
  const task = useTransferStore.getState().tasks.find(t => t.id === data.transferId)
  if (task) completedBlobs.set(data.transferId, { blob, fileName: task.fileName })
  useTransferStore.getState().updateProgress(data.transferId, session.totalBytes, 0)
  useTransferStore.getState().updateStatus(data.transferId, 'completed')
  session.resolve(blob)
  dlSessions.delete(data.transferId)
  lastUpdate.delete(data.transferId)
}

/** 处理下载错误 */
export function handleDownloadError(transferId: string, message: string): void {
  const session = dlSessions.get(transferId)
  if (!session) return
  useTransferStore.getState().updateStatus(transferId, 'failed', message)
  session.reject(new Error(message))
  dlSessions.delete(transferId)
  lastUpdate.delete(transferId)
}

/** 取消下载 */
export function cancelDownload(send: SendFn, transferId: string): void {
  send('sftp-download-cancel', { transferId })
  const session = dlSessions.get(transferId)
  if (session) {
    session.reject(new Error('下载已取消'))
    dlSessions.delete(transferId)
  }
  useTransferStore.getState().cancel(transferId)
  lastUpdate.delete(transferId)
}

/** 获取已完成下载的 Blob */
export function getDownloadBlob(transferId: string): Blob | null {
  return completedBlobs.get(transferId)?.blob ?? null
}

/** 保存已完成的下载到本地默认目录（优先使用设置中的 sftpDefaultSavePath） */
export async function saveDownload(transferId: string): Promise<string | null> {
  const entry = completedBlobs.get(transferId)
  if (!entry) return null

  try {
    const { saveDownloadToLocal } = await import('../api/client')
    const defaultPath = useSettingsStore.getState().sftpDefaultSavePath
    const savedPath = await saveDownloadToLocal(entry.blob, entry.fileName, defaultPath || undefined)
    completedBlobs.delete(transferId)
    return savedPath
  } catch (err) {
    throw new Error(`保存失败: ${(err as Error).message}`)
  }
}

/** 保存已完成的下载到用户指定路径（弹出保存对话框） */
export async function saveDownloadTo(transferId: string): Promise<string | null> {
  const entry = completedBlobs.get(transferId)
  if (!entry) return null

  try {
    const { pickSavePath, saveDownloadToLocal } = await import('../api/client')
    const targetPath = await pickSavePath(entry.fileName)
    if (!targetPath) return null

    // 从完整路径中提取目录和文件名
    const lastSep = Math.max(targetPath.lastIndexOf('/'), targetPath.lastIndexOf('\\'))
    const dir = targetPath.substring(0, lastSep)
    const name = targetPath.substring(lastSep + 1)

    const savedPath = await saveDownloadToLocal(entry.blob, name, dir)
    completedBlobs.delete(transferId)
    return savedPath
  } catch (err) {
    throw new Error(`保存失败: ${(err as Error).message}`)
  }
}

/** 下载到本地并用系统默认程序打开 */
export async function saveAndOpenLocal(transferId: string): Promise<void> {
  const entry = completedBlobs.get(transferId)
  if (!entry) return

  try {
    const { saveDownloadToLocal, openLocalFile } = await import('../api/client')
    const savedPath = await saveDownloadToLocal(entry.blob, entry.fileName)
    completedBlobs.delete(transferId)
    await openLocalFile(savedPath)
  } catch (err) {
    throw new Error(`打开失败: ${(err as Error).message}`)
  }
}

/** 清理已完成下载的 Blob 缓存 */
export function clearDownloadBlob(transferId: string): void {
  completedBlobs.delete(transferId)
}
