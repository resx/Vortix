/* ── 传输执行引擎 ── */
/* 桥接 useTransferStore 和 SFTP WebSocket，处理分块上传/下载 */

import { useTransferStore } from '../stores/useTransferStore'

const CHUNK_SIZE = 64 * 1024 // 64KB

/** 速度计算：滑动窗口平均（最近 5 个 chunk） */
class SpeedTracker {
  private samples: { bytes: number; time: number }[] = []
  private windowSize = 5

  push(bytes: number): number {
    this.samples.push({ bytes, time: Date.now() })
    if (this.samples.length > this.windowSize) this.samples.shift()
    if (this.samples.length < 2) return 0
    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    const elapsed = (last.time - first.time) / 1000
    if (elapsed <= 0) return 0
    const totalBytes = this.samples.slice(1).reduce((sum, s) => sum + s.bytes, 0)
    return totalBytes / elapsed
  }
}

/** 生成传输 ID */
export function generateTransferId(): string {
  return `tf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 上传文件到远程 */
export async function uploadFile(
  ws: WebSocket,
  file: File,
  remotePath: string,
  connectionId: string,
  connectionName: string,
): Promise<void> {
  const store = useTransferStore.getState()
  const transferId = generateTransferId()
  const fullRemotePath = remotePath.endsWith('/')
    ? `${remotePath}${file.name}`
    : `${remotePath}/${file.name}`

  store.enqueue({
    id: transferId,
    type: 'upload',
    fileName: file.name,
    remotePath: fullRemotePath,
    fileSize: file.size,
    connectionId,
    connectionName,
  })

  const tracker = new SpeedTracker()

  // 发送 upload-start
  ws.send(JSON.stringify({
    type: 'sftp-upload-start',
    data: { transferId, remotePath: fullRemotePath, fileName: file.name, fileSize: file.size },
  }))

  store.updateStatus(transferId, 'active')

  // 分块读取并发送
  let offset = 0
  const reader = file.stream().getReader()

  try {
    while (true) {
      const task = useTransferStore.getState().tasks.find(t => t.id === transferId)
      if (!task || task.status === 'cancelled') {
        reader.cancel()
        return
      }

      // 暂停等待
      if (task.status === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 500))
        continue
      }

      const { done, value } = await reader.read()
      if (done) break

      // 分块发送
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        const chunk = value.slice(i, i + CHUNK_SIZE)
        const base64 = btoa(String.fromCharCode(...chunk))
        ws.send(JSON.stringify({
          type: 'sftp-upload-chunk',
          data: { transferId, chunk: base64, offset },
        }))
        offset += chunk.length
        const speed = tracker.push(chunk.length)
        store.updateProgress(transferId, offset, speed)
      }
    }

    // 发送 upload-end
    ws.send(JSON.stringify({
      type: 'sftp-upload-end',
      data: { transferId },
    }))

    store.updateStatus(transferId, 'completed')
  } catch (err) {
    store.updateStatus(transferId, 'failed', (err as Error).message)
  }
}

/** 处理下载 chunk 消息 */
const downloadBuffers = new Map<string, { chunks: ArrayBuffer[]; fileName: string }>()

export function handleDownloadChunk(data: {
  transferId: string
  chunk: string
  bytesTransferred: number
  fileSize: number
  fileName: string
}): void {
  const store = useTransferStore.getState()
  const task = store.tasks.find(t => t.id === data.transferId)
  if (!task || task.status === 'cancelled') return

  // 解码 base64 chunk
  const binary = atob(data.chunk)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  let buf = downloadBuffers.get(data.transferId)
  if (!buf) {
    buf = { chunks: [], fileName: data.fileName }
    downloadBuffers.set(data.transferId, buf)
  }
  buf.chunks.push(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))

  // 简单速度估算
  store.updateProgress(data.transferId, data.bytesTransferred, 0)
}

/** 处理下载完成 */
export function handleDownloadComplete(data: {
  transferId: string
  remotePath: string
  bytesTransferred: number
}): void {
  const store = useTransferStore.getState()
  const buf = downloadBuffers.get(data.transferId)

  if (buf) {
    // 合并 chunks 并触发浏览器下载
    const blob = new Blob(buf.chunks)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = buf.fileName
    a.click()
    URL.revokeObjectURL(url)
    downloadBuffers.delete(data.transferId)
  }

  store.updateStatus(data.transferId, 'completed')
}

/** 发起下载请求 */
export function downloadFile(
  ws: WebSocket,
  remotePath: string,
  fileName: string,
  fileSize: number,
  connectionId: string,
  connectionName: string,
): string {
  const store = useTransferStore.getState()
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

  ws.send(JSON.stringify({
    type: 'sftp-download-start',
    data: { transferId, remotePath },
  }))

  return transferId
}

/** 取消下载 */
export function cancelDownload(ws: WebSocket, transferId: string): void {
  ws.send(JSON.stringify({
    type: 'sftp-download-cancel',
    data: { transferId },
  }))
  downloadBuffers.delete(transferId)
  useTransferStore.getState().cancel(transferId)
}
