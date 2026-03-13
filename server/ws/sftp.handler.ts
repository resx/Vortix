/* ── SFTP WebSocket 处理器 ── */
/* 独立 /ws/sftp 端点，与终端 I/O 隔离 */

import { WebSocketServer, WebSocket } from 'ws'
import { Client } from 'ssh2'
import type http from 'http'
import path from 'path'
import { SftpService } from '../services/sftp.service.js'
import type {
  SftpConnectData,
  SftpListData,
  SftpMkdirData,
  SftpRenameData,
  SftpDeleteData,
  SftpStatData,
  SftpReadFileData,
  SftpWriteFileData,
  SftpUploadStartData,
  SftpUploadChunkData,
  SftpUploadEndData,
  SftpDownloadStartData,
  SftpDownloadCancelData,
  SftpChmodData,
  SftpTouchData,
  SftpExecData,
} from '../types/sftp.js'

/** 发送 JSON 消息 */
function send(ws: WebSocket, type: string, data?: unknown, requestId?: string) {
  if (ws.readyState !== WebSocket.OPEN) return
  const msg: Record<string, unknown> = { type }
  if (data !== undefined) msg.data = data
  if (requestId) msg.requestId = requestId
  ws.send(JSON.stringify(msg))
}

/** 发送错误 */
function sendError(ws: WebSocket, message: string, requestId?: string) {
  send(ws, 'sftp-error', { message }, requestId)
}

/** 上传会话 */
interface UploadSession {
  stream: NodeJS.WritableStream
  remotePath: string
  bytesWritten: number
  fileSize: number
}

/** 下载会话 */
interface DownloadSession {
  aborted: boolean
}

export function setupSftpWebSocket(server: http.Server): WebSocketServer {
  void server
  const wss = new WebSocketServer({ noServer: true })

  wss.on('connection', (ws: WebSocket) => {
    let sshClient: Client | null = null
    let sftpService: SftpService | null = null
    const uploadSessions = new Map<string, UploadSession>()
    const downloadSessions = new Map<string, DownloadSession>()

    // 心跳
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
    }, 30000)

    ws.on('message', async (raw: Buffer) => {
      let msg: { type: string; data?: unknown; requestId?: string }
      try { msg = JSON.parse(raw.toString()) } catch { return }
      if (msg.type === 'pong') return

      const rid = msg.requestId

      try {
        switch (msg.type) {
          // ── 连接 ──
          case 'sftp-connect': {
            const d = msg.data as SftpConnectData
            if (!d?.host || !d?.username) { sendError(ws, '缺少主机或用户名', rid); break }

            const portNum = Number(d.port) || 22
            if (portNum < 1 || portNum > 65535) { sendError(ws, '端口号无效', rid); break }

            sshClient = new Client()

            sshClient.on('ready', async () => {
              try {
                sftpService = new SftpService(sshClient!)
                await sftpService.init()
                const home = await sftpService.realpath('.')
                send(ws, 'sftp-ready', { home }, rid)
              } catch (err) {
                sendError(ws, `SFTP 初始化失败: ${(err as Error).message}`, rid)
              }
            })

            sshClient.on('error', (err) => {
              sendError(ws, err.message, rid)
            })

            sshClient.on('close', () => {
              sftpService?.destroy()
              sftpService = null
              sshClient = null
            })

            const config: Record<string, unknown> = {
              host: d.host, port: portNum, username: d.username, readyTimeout: 10000,
            }
            if (d.privateKey) {
              config.privateKey = d.privateKey
              if (d.passphrase) config.passphrase = d.passphrase
            } else if (d.password) {
              config.password = d.password
            }

            sshClient.connect(config as Parameters<Client['connect']>[0])
            break
          }

          // ── 列出目录 ──
          case 'sftp-list': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpListData
            const entries = await sftpService.listDir(d.path)
            send(ws, 'sftp-list-result', { path: d.path, entries }, rid)
            break
          }

          // ── 创建目录 ──
          case 'sftp-mkdir': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpMkdirData
            await sftpService.mkdir(d.path)
            send(ws, 'sftp-mkdir-ok', { path: d.path }, rid)
            break
          }

          // ── 重命名 ──
          case 'sftp-rename': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpRenameData
            await sftpService.rename(d.oldPath, d.newPath)
            send(ws, 'sftp-rename-ok', { oldPath: d.oldPath, newPath: d.newPath }, rid)
            break
          }

          // ── 删除 ──
          case 'sftp-delete': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpDeleteData
            if (d.isDir) {
              await sftpService.removeDirRecursive(d.path)
            } else {
              await sftpService.removeFile(d.path)
            }
            send(ws, 'sftp-delete-ok', { path: d.path }, rid)
            break
          }

          // ── 文件信息 ──
          case 'sftp-stat': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpStatData
            const stat = await sftpService.stat(d.path)
            send(ws, 'sftp-stat-result', stat, rid)
            break
          }

          // ── 读取文件（文本编辑用） ──
          case 'sftp-read-file': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpReadFileData
            const content = await sftpService.readFile(d.path)
            send(ws, 'sftp-read-file-result', { path: d.path, content }, rid)
            break
          }

          // ── 写入文件（文本编辑用） ──
          case 'sftp-write-file': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpWriteFileData
            await sftpService.writeFile(d.path, d.content)
            send(ws, 'sftp-write-file-ok', { path: d.path }, rid)
            break
          }

          // ── 上传：开始 ──
          case 'sftp-upload-start': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpUploadStartData
            const stream = sftpService.createWriteStream(d.remotePath)
            uploadSessions.set(d.transferId, {
              stream, remotePath: d.remotePath,
              bytesWritten: 0, fileSize: d.fileSize,
            })
            stream.on('error', (err) => {
              sendError(ws, `上传失败: ${err.message}`, rid)
              uploadSessions.delete(d.transferId)
            })
            break
          }

          // ── 上传：分块 ──
          case 'sftp-upload-chunk': {
            const d = msg.data as SftpUploadChunkData
            const session = uploadSessions.get(d.transferId)
            if (!session) { sendError(ws, '上传会话不存在', rid); break }
            const buf = Buffer.from(d.chunk, 'base64')
            session.stream.write(buf)
            session.bytesWritten += buf.length
            send(ws, 'sftp-upload-progress', {
              transferId: d.transferId,
              bytesTransferred: session.bytesWritten,
              fileSize: session.fileSize,
            })
            break
          }

          // ── 上传：结束 ──
          case 'sftp-upload-end': {
            const d = msg.data as SftpUploadEndData
            const session = uploadSessions.get(d.transferId)
            if (!session) { sendError(ws, '上传会话不存在', rid); break }
            session.stream.end(() => {
              send(ws, 'sftp-upload-ok', {
                transferId: d.transferId,
                remotePath: session.remotePath,
                bytesTransferred: session.bytesWritten,
              }, rid)
              uploadSessions.delete(d.transferId)
            })
            break
          }

          // ── 下载：开始 ──
          case 'sftp-download-start': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpDownloadStartData
            const dlStat = await sftpService.stat(d.remotePath)
            const dlSession: DownloadSession = { aborted: false }
            downloadSessions.set(d.transferId, dlSession)

            const readStream = sftpService.createReadStream(d.remotePath)
            let bytesRead = 0

            readStream.on('data', (chunk: Buffer) => {
              if (dlSession.aborted) { readStream.destroy(); return }
              bytesRead += chunk.length
              send(ws, 'sftp-download-chunk', {
                transferId: d.transferId,
                chunk: chunk.toString('base64'),
                bytesTransferred: bytesRead,
                fileSize: dlStat.size,
                fileName: path.posix.basename(d.remotePath),
              })
            })

            readStream.on('end', () => {
              if (!dlSession.aborted) {
                send(ws, 'sftp-download-ok', {
                  transferId: d.transferId,
                  remotePath: d.remotePath,
                  bytesTransferred: bytesRead,
                }, rid)
              }
              downloadSessions.delete(d.transferId)
            })

            readStream.on('error', (err) => {
              sendError(ws, `下载失败: ${err.message}`, rid)
              downloadSessions.delete(d.transferId)
            })
            break
          }

          // ── 下载：取消 ──
          case 'sftp-download-cancel': {
            const d = msg.data as SftpDownloadCancelData
            const cancelSession = downloadSessions.get(d.transferId)
            if (cancelSession) {
              cancelSession.aborted = true
              downloadSessions.delete(d.transferId)
            }
            break
          }

          // ── 修改权限 ──
          case 'sftp-chmod': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpChmodData
            const mode = parseInt(d.mode, 8)
            if (isNaN(mode) || mode < 0 || mode > 0o7777) { sendError(ws, '无效的权限值', rid); break }
            if (d.recursive) {
              await sftpService.chmodRecursive(d.path, mode)
            } else {
              await sftpService.chmod(d.path, mode)
            }
            send(ws, 'sftp-chmod-ok', { path: d.path, mode: d.mode }, rid)
            break
          }

          // ── 新建文件/目录 ──
          case 'sftp-touch': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpTouchData
            await sftpService.touch(d.path, d.isDir)
            send(ws, 'sftp-touch-ok', { path: d.path, isDir: !!d.isDir }, rid)
            break
          }

          // ── 远程执行命令（白名单） ──
          case 'sftp-exec': {
            if (!sftpService) { sendError(ws, 'SFTP 未连接', rid); break }
            const d = msg.data as SftpExecData
            const result = await sftpService.exec(d.command)
            send(ws, 'sftp-exec-result', result, rid)
            break
          }

          // ── 断开 ──
          case 'sftp-disconnect': {
            cleanup()
            break
          }
        }
      } catch (err) {
        sendError(ws, (err as Error).message, rid)
      }
    })

    function cleanup() {
      for (const [, session] of uploadSessions) {
        try { session.stream.end() } catch { /* 静默 */ }
      }
      uploadSessions.clear()
      for (const [, session] of downloadSessions) {
        session.aborted = true
      }
      downloadSessions.clear()
      sftpService?.destroy()
      sftpService = null
      sshClient?.end()
      sshClient = null
    }

    ws.on('close', () => {
      clearInterval(heartbeat)
      cleanup()
    })
  })

  return wss
}
