import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import { Client } from 'ssh2'
import http from 'http'

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
                ws.send(JSON.stringify({ type: 'status', data: 'closed' }))
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

      // 断开连接
      case 'disconnect': {
        sshClient?.end()
        sshClient = null
        break
      }
    }
  })

  ws.on('close', () => {
    sshClient?.end()
    sshClient = null
  })
})

const PORT = Number(process.env.SSH_SERVER_PORT) || 3001

server.listen(PORT, () => {
  console.log(`[Vortix SSH Server] 运行在 http://localhost:${PORT}`)
})
