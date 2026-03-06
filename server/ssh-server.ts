import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import { Client } from 'ssh2'
import http from 'http'
import { HighlightInterceptor } from './highlight-interceptor'
import type { HighlightConfig } from './highlight-interceptor'

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws/ssh' })

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

wss.on('connection', (ws: WebSocket) => {
  let sshClient: Client | null = null
  let highlightInterceptor: HighlightInterceptor | null = null
  let sshStream: import('ssh2').ClientChannel | null = null

  // 输出到前端的统一方法
  const sendOutput = (data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }))
    }
  }

  // 初始化或更新拦截器
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

  // 统一消息处理器（只注册一次）
  ws.on('message', (raw: Buffer) => {
    let msg: { type: string; data?: unknown }
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    switch (msg.type) {
      // 建立 SSH 连接
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
                ws.send(JSON.stringify({ type: 'status', data: 'closed' }))
                ws.close()
              })
            },
          )
        })

        sshClient.on('error', (err) => {
          ws.send(JSON.stringify({ type: 'error', data: err.message }))
        })

        sshClient.on('close', () => {
          ws.send(JSON.stringify({ type: 'status', data: 'closed' }))
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

      // 前端输入 -> SSH
      case 'input': {
        if (sshStream) sshStream.write(msg.data as string)
        break
      }

      // 终端尺寸调整
      case 'resize': {
        if (sshStream) {
          const { cols, rows } = msg.data as { cols: number; rows: number }
          sshStream.setWindow(rows, cols, 0, 0)
        }
        break
      }

      // 高亮配置（可在连接前/后任意时刻接收）
      case 'highlight-config': {
        setupHighlight(msg.data as Partial<HighlightConfig>)
        break
      }

      // 断开连接
      case 'disconnect': {
        sshStream = null
        sshClient?.end()
        sshClient = null
        break
      }
    }
  })

  ws.on('close', () => {
    highlightInterceptor?.destroy()
    highlightInterceptor = null
    sshStream = null
    sshClient?.end()
    sshClient = null
  })
})

const PORT = Number(process.env.SSH_SERVER_PORT) || 3001

server.listen(PORT, () => {
  console.log(`[Vortix SSH Server] 运行在 http://localhost:${PORT}`)
})
