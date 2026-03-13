/* ── SFTP 传输提供者 ── */
/* 从 transfer-engine 抽取的 SFTP 实现，符合 TransferProvider 接口 */

import type { TransferProvider, TransferUploadParams, TransferDownloadParams, TransferProgress } from './types'

const CHUNK_SIZE = 64 * 1024

export class SftpTransferProvider implements TransferProvider {
  readonly protocol = 'sftp' as const
  private ws: WebSocket
  private abortedIds = new Set<string>()

  constructor(ws: WebSocket) {
    this.ws = ws
  }

  async *upload(params: TransferUploadParams): AsyncGenerator<TransferProgress> {
    const { transferId, localFile, remotePath } = params

    this.ws.send(JSON.stringify({
      type: 'sftp-upload-start',
      data: { transferId, remotePath, fileName: localFile.name, fileSize: localFile.size },
    }))

    const reader = localFile.stream().getReader()
    let offset = 0

    try {
      while (true) {
        if (this.abortedIds.has(transferId)) return
        const { done, value } = await reader.read()
        if (done) break

        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          if (this.abortedIds.has(transferId)) return
          const chunk = value.slice(i, i + CHUNK_SIZE)
          const base64 = btoa(String.fromCharCode(...chunk))
          this.ws.send(JSON.stringify({
            type: 'sftp-upload-chunk',
            data: { transferId, chunk: base64, offset },
          }))
          offset += chunk.length
          yield { transferId, bytesTransferred: offset, totalBytes: localFile.size, speed: 0 }
        }
      }

      this.ws.send(JSON.stringify({ type: 'sftp-upload-end', data: { transferId } }))
      yield { transferId, bytesTransferred: offset, totalBytes: localFile.size, speed: 0 }
    } finally {
      reader.cancel()
      this.abortedIds.delete(transferId)
    }
  }

  async *download(params: TransferDownloadParams): AsyncGenerator<TransferProgress> {
    const { transferId, remotePath } = params

    this.ws.send(JSON.stringify({
      type: 'sftp-download-start',
      data: { transferId, remotePath },
    }))

    // 下载由 WebSocket 消息驱动，此处仅发起请求
    // 实际进度通过 transfer-engine 的 handleDownloadChunk 处理
    yield { transferId, bytesTransferred: 0, totalBytes: params.fileSize, speed: 0 }
  }

  abort(transferId: string): void {
    this.abortedIds.add(transferId)
    this.ws.send(JSON.stringify({
      type: 'sftp-download-cancel',
      data: { transferId },
    }))
  }
}
