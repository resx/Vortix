/* ── 服务器启动入口 ── */

import http from 'http'
import app from './app.js'
import { runMigrations } from './db/migrate.js'
import { setupWebSocket } from './ws/ssh.handler.js'

// 初始化数据库
runMigrations()

// 创建 HTTP 服务器
const server = http.createServer(app)

// 挂载 WebSocket
setupWebSocket(server)

// 启动监听
const PORT = Number(process.env.SSH_SERVER_PORT) || 3001

server.listen(PORT, () => {
  console.log(`[Vortix SSH Server] 运行在 http://localhost:${PORT}`)
  console.log(`[Vortix API] REST API: http://localhost:${PORT}/api`)
  console.log(`[Vortix WS] WebSocket: ws://localhost:${PORT}/ws/ssh`)
})
