/* ── WebSocket SSH 处理（从 ssh-server.ts 抽出） ── */

import { WebSocketServer, WebSocket } from 'ws'
import { Client } from 'ssh2'
import type http from 'http'

export function setupWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/ssh' })

  wss.on('connection', (ws: WebSocket) => {
    let sshClient: Client | null = null
    let lastActivity = Date.now()

    // 心跳检测（30 秒间隔）
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // 检查超时（5 分钟无活动断开）
        if (Date.now() - lastActivity > 5 * 60 * 1000) {
          ws.send(JSON.stringify({ type: 'status', data: 'timeout' }))
          ws.close()
          return
        }
        ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000)

    ws.on('message', (raw: Buffer) => {
      let msg: { type: string; data?: unknown }
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      lastActivity = Date.now()

      // 响应心跳
      if (msg.type === 'pong') return

      switch (msg.type) {
        case 'connect': {
          const { host, port, username, password, privateKey } = msg.data as {
            host: string
            port: number
            username: string
            password?: string
            privateKey?: string
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

                // SSH -> 前端
                stream.on('data', (chunk: Buffer) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'output', data: chunk.toString('binary') }))
                  }
                })

                stream.stderr.on('data', (chunk: Buffer) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'output', data: chunk.toString('binary') }))
                  }
                })

                stream.on('close', () => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'status', data: 'closed' }))
                  }
                  ws.close()
                })

                // 前端输入 -> SSH
                ws.on('message', (raw: Buffer) => {
                  let innerMsg: { type: string; data?: unknown }
                  try {
                    innerMsg = JSON.parse(raw.toString())
                  } catch {
                    return
                  }

                  lastActivity = Date.now()

                  if (innerMsg.type === 'input') {
                    stream.write(innerMsg.data as string)
                  } else if (innerMsg.type === 'resize') {
                    const { cols, rows } = innerMsg.data as { cols: number; rows: number }
                    stream.setWindow(rows, cols, 0, 0)
                  }
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
            host,
            port: port || 22,
            username,
            readyTimeout: 10000,
          }

          if (privateKey) {
            connectConfig.privateKey = privateKey
          } else if (password) {
            connectConfig.password = password
          }

          sshClient.connect(connectConfig as Parameters<Client['connect']>[0])
          break
        }

        case 'disconnect': {
          sshClient?.end()
          sshClient = null
          break
        }
      }
    })

    ws.on('close', () => {
      clearInterval(heartbeatInterval)
      sshClient?.end()
      sshClient = null
    })
  })

  return wss
}
