/* ── SFTP 上传辅助 ── */

/** 分块大小：64KB */
const CHUNK_SIZE = 64 * 1024

/** 生成唯一传输 ID */
function genTransferId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 弹出文件选择器 */
export function pickFiles(multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = multiple
    input.onchange = () => {
      resolve(input.files ? Array.from(input.files) : [])
    }
    // 用户取消时不会触发 change，用 focus 兜底
    window.addEventListener('focus', () => {
      setTimeout(() => {
        if (!input.files?.length) resolve([])
      }, 300)
    }, { once: true })
    input.click()
  })
}

/** 弹出文件夹选择器 */
export function pickFolder(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.setAttribute('webkitdirectory', '')
    input.onchange = () => {
      resolve(input.files ? Array.from(input.files) : [])
    }
    window.addEventListener('focus', () => {
      setTimeout(() => {
        if (!input.files?.length) resolve([])
      }, 300)
    }, { once: true })
    input.click()
  })
}

interface UploadOptions {
  /** WS send 函数 */
  send: (type: string, data?: unknown) => void
  /** 远程目标目录 */
  remotePath: string
  /** 进度回调 */
  onProgress?: (transferId: string, bytesTransferred: number, fileSize: number) => void
  /** 完成回调 */
  onComplete?: (transferId: string, remotePath: string) => void
  /** 错误回调 */
  onError?: (transferId: string, error: string) => void
}

/** 将 File 读取为 base64 分块并通过 WS 上传 */
export async function uploadFile(file: File, opts: UploadOptions): Promise<string> {
  const transferId = genTransferId()
  const fileName = file.name
  const remoteFilePath = opts.remotePath === '/'
    ? `/${fileName}`
    : `${opts.remotePath}/${fileName}`

  // 1. 开始上传
  opts.send('sftp-upload-start', {
    transferId,
    remotePath: remoteFilePath,
    fileSize: file.size,
    fileName,
  })

  // 2. 分块读取并发送
  let offset = 0
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE)
    const buf = await slice.arrayBuffer()
    const base64 = btoa(
      new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ''),
    )
    opts.send('sftp-upload-chunk', { transferId, chunk: base64 })
    offset += slice.size
    opts.onProgress?.(transferId, offset, file.size)
  }

  // 3. 结束上传
  opts.send('sftp-upload-end', { transferId })
  opts.onComplete?.(transferId, remoteFilePath)

  return transferId
}

/** 批量上传多个文件 */
export async function uploadFiles(files: File[], opts: UploadOptions): Promise<string[]> {
  const ids: string[] = []
  for (const file of files) {
    const id = await uploadFile(file, opts)
    ids.push(id)
  }
  return ids
}
