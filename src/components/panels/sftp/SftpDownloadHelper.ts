/* ── SFTP 下载辅助 ── */

/** 生成唯一传输 ID */
function genTransferId(): string {
  return `download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface DownloadSession {
  transferId: string
  fileName: string
  chunks: string[]
  bytesTransferred: number
  fileSize: number
  resolve: (blob: Blob) => void
  reject: (err: Error) => void
}

/** 活跃下载会话 */
const activeSessions = new Map<string, DownloadSession>()

/** 处理下载 chunk 消息（由 useSftpConnection 的 handleMessage 调用） */
export function handleDownloadChunk(data: {
  transferId: string
  chunk: string
  bytesTransferred: number
  fileSize: number
  fileName: string
}): void {
  const session = activeSessions.get(data.transferId)
  if (!session) return
  session.chunks.push(data.chunk)
  session.bytesTransferred = data.bytesTransferred
  session.fileSize = data.fileSize
}

/** 处理下载完成消息 */
export function handleDownloadOk(data: { transferId: string }): void {
  const session = activeSessions.get(data.transferId)
  if (!session) return
  // base64 chunks → Blob
  const bytes = session.chunks.map(c => Uint8Array.from(atob(c), ch => ch.charCodeAt(0)))
  const totalLen = bytes.reduce((sum, b) => sum + b.length, 0)
  const merged = new Uint8Array(totalLen)
  let offset = 0
  for (const b of bytes) {
    merged.set(b, offset)
    offset += b.length
  }
  const blob = new Blob([merged])
  session.resolve(blob)
  activeSessions.delete(data.transferId)
}

/** 处理下载错误 */
export function handleDownloadError(transferId: string, message: string): void {
  const session = activeSessions.get(transferId)
  if (!session) return
  session.reject(new Error(message))
  activeSessions.delete(transferId)
}

interface DownloadOptions {
  send: (type: string, data?: unknown) => void
  remotePath: string
  fileName?: string
}

/** 发起下载并返回 Blob（通过 WS 流式接收） */
export function downloadFile(opts: DownloadOptions): { transferId: string; promise: Promise<Blob> } {
  const transferId = genTransferId()
  const fileName = opts.fileName || opts.remotePath.split('/').pop() || 'download'

  const promise = new Promise<Blob>((resolve, reject) => {
    activeSessions.set(transferId, {
      transferId,
      fileName,
      chunks: [],
      bytesTransferred: 0,
      fileSize: 0,
      resolve,
      reject,
    })
  })

  opts.send('sftp-download-start', { transferId, remotePath: opts.remotePath })

  return { transferId, promise }
}

/** 下载文件并触发浏览器保存 */
export async function downloadToBrowser(opts: DownloadOptions): Promise<void> {
  const { promise } = downloadFile(opts)
  const blob = await promise
  const fileName = opts.fileName || opts.remotePath.split('/').pop() || 'download'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** 取消下载 */
export function cancelDownload(transferId: string, send: (type: string, data?: unknown) => void): void {
  send('sftp-download-cancel', { transferId })
  const session = activeSessions.get(transferId)
  if (session) {
    session.reject(new Error('下载已取消'))
    activeSessions.delete(transferId)
  }
}
