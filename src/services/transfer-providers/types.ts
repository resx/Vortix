/* ── 传输协议提供者接口 ── */
/* 当前仅实现 SFTP，未来可扩展 SCP/trzsz/lrzsz */

/** 传输进度 */
export interface TransferProgress {
  transferId: string
  bytesTransferred: number
  totalBytes: number
  speed: number
}

/** 上传参数 */
export interface TransferUploadParams {
  transferId: string
  localFile: File
  remotePath: string
  connectionId: string
}

/** 下载参数 */
export interface TransferDownloadParams {
  transferId: string
  remotePath: string
  fileName: string
  fileSize: number
  connectionId: string
}

/** 传输协议提供者接口 */
export interface TransferProvider {
  readonly protocol: 'sftp' | 'scp' | 'trzsz' | 'lrzsz'
  upload(params: TransferUploadParams): AsyncGenerator<TransferProgress>
  download(params: TransferDownloadParams): AsyncGenerator<TransferProgress>
  abort(transferId: string): void
}
