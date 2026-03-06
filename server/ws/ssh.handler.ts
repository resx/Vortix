/* ── WebSocket 终端处理（SSH + 本地 PTY + 高亮拦截器） ── */

import { WebSocketServer, WebSocket } from 'ws'
import { Client } from 'ssh2'
import type { IPty } from 'node-pty'
import type http from 'http'
import { HighlightInterceptor } from '../highlight-interceptor'
import type { HighlightConfig } from '../highlight-interceptor'
import { createLocalPty } from './local.handler'

export function setupWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/ssh' })

  wss.on('connection', (ws: WebSocket) => {
    let sshClient: Client | null = null
    let sshStream: import('ssh2').ClientChannel | null = null
    let ptyProcess: IPty | null = null
    let highlightInterceptor: HighlightInterceptor | null = null
    let lastActivity = Date.now()

    // 输出到前端的统一方法
    const sendOutput = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }))
      }
    }

    // 初始化或更新高亮拦截器
    const setupHighlight = (config: Partial<HighlightConfig>) => {
      if (!highlightInterceptor) {
        highlightInterceptor = new HighlightInterceptor(config)
        highlightInterceptor.on('data', sendOutput)
      } else {
        highlightInterceptor.updateConfig(config)
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'highlight-config-ack',
          data: { categories: highlightInterceptor.getCategories() },
        }))
      }
    }

    // 心跳检测（30 秒间隔）
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        if (Date.now() - lastActivity > 5 * 60 * 1000) {
          ws.send(JSON.stringify({ type: 'status', data: 'timeout' }))
          ws.close()
          return
        }
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    // 统一消息处理器（只注册一次）
    ws.on('message', (raw: Buffer) => {
      let msg: { type: string; data?: unknown }
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      lastActivity = Date.now()
      if (msg.type === 'pong') return

      switch (msg.type) {
        case 'connect': {
          const data = msg.data as Record<string, unknown>

          // ── 本地终端分支 ──
          if (data.type === 'local') {
            try {
              ptyProcess = createLocalPty(ws, {
                shell: data.shell as string,
                workingDir: data.workingDir as string | undefined,
                initialCommand: data.initialCommand as string | undefined,
                cols: data.cols as number | undefined,
                rows: data.rows as number | undefined,
              })
            } catch (err) {
              ws.send(JSON.stringify({ type: 'error', data: (err as Error).message }))
            }
            break
          }

          // ── SSH 连接分支 ──
          const { host, port, username, password, privateKey } = data as {
            host: string; port: number; username: string; password?: string; privateKey?: string
          }

          sshClient = new Client()

          sshClient.on('ready', () => {
            ws.send(JSON.stringify({ type: 'status', data: 'connected' }))

            sshClient!.shell(
              { term: 'xterm-256color', cols: 120, rows: 30 },
              (err, stream) => {
                if (err) {
                  ws.send(JSON.stringify({ type: 'error', data: err.message }))
                  return
                }

                sshStream = stream

                // SSH -> 前端（经过高亮拦截器）
                stream.on('data', (chunk: Buffer) => {
                  const text = chunk.toString('binary')
                  if (highlightInterceptor) {
                    highlightInterceptor.processChunk(text)
                  } else {
                    sendOutput(text)
                  }
                })

                stream.stderr.on('data', (chunk: Buffer) => {
                  const text = chunk.toString('binary')
                  if (highlightInterceptor) {
                    highlightInterceptor.processChunk(text)
                  } else {
                    sendOutput(text)
                  }
                })

                stream.on('close', () => {
                  sshStream = null
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'status', data: 'closed' }))
                  }
                  ws.close()
                })
              },
            )
          })

          sshClient.on('error', (err) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', data: err.message }))
            }
          })

          sshClient.on('close', () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'status', data: 'closed' }))
            }
          })

          const connectConfig: Record<string, unknown> = {
            host, port: port || 22, username, readyTimeout: 10000,
          }
          if (privateKey) connectConfig.privateKey = privateKey
          else if (password) connectConfig.password = password

          sshClient.connect(connectConfig as Parameters<Client['connect']>[0])
          break
        }

        // 前端输入
        case 'input': {
          if (ptyProcess) ptyProcess.write(msg.data as string)
          else if (sshStream) sshStream.write(msg.data as string)
          break
        }

        // 终端尺寸调整
        case 'resize': {
          const { cols, rows } = msg.data as { cols: number; rows: number }
          if (ptyProcess) ptyProcess.resize(cols, rows)
          else if (sshStream) sshStream.setWindow(rows, cols, 0, 0)
          break
        }

        // 高亮配置（可在连接前/后任意时刻接收）
        case 'highlight-config': {
          setupHighlight(msg.data as Partial<HighlightConfig>)
          break
        }

        // 断开连接
        case 'disconnect': {
          if (ptyProcess) { ptyProcess.kill(); ptyProcess = null }
          sshStream = null
          sshClient?.end()
          sshClient = null
          break
        }
      }
    })

    ws.on('close', () => {
      clearInterval(heartbeatInterval)
      highlightInterceptor?.destroy()
      highlightInterceptor = null
      if (ptyProcess) { ptyProcess.kill(); ptyProcess = null }
      sshStream = null
      sshClient?.end()
      sshClient = null
    })
  })

  return wss
}
