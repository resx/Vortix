/* ── 服务器启动入口 ── */

import http from 'http'
import app from './app.js'
import { migrateToJson } from './db/migrate-to-json.js'
import { initStores } from './db/stores.js'
import { setupWebSocket } from './ws/ssh.handler.js'
import { setupSftpWebSocket } from './ws/sftp.handler.js'
import * as autoSync from './services/auto-sync.service.js'

// 从 SQLite 迁移到 JSON（首次升级时自动执行）
await migrateToJson()

// 初始化 JSON 存储
initStores()

// 创建 HTTP 服务器
const server = http.createServer(app)

// 挂载 WebSocket（均使用 noServer 模式，统一 upgrade 路由）
const sshWss = setupWebSocket(server)
const sftpWss = setupSftpWebSocket(server)

server.on('upgrade', (req, socket, head) => {
  const pathname = req.url?.split('?')[0]
  if (pathname === '/ws/ssh') {
    sshWss.handleUpgrade(req, socket, head, (ws) => {
      sshWss.emit('connection', ws, req)
    })
  } else if (pathname === '/ws/sftp') {
    sftpWss.handleUpgrade(req, socket, head, (ws) => {
      sftpWss.emit('connection', ws, req)
    })
  } else {
    socket.destroy()
  }
})

// 初始化自动同步（传入 WSS 用于冲突通知）
autoSync.init(sshWss)

// 启动监听
const PORT = Number(process.env.SSH_SERVER_PORT) || 3001

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Vortix SSH Server] 运行在 http://127.0.0.1:${PORT}`)
  console.log(`[Vortix API] REST API: http://127.0.0.1:${PORT}/api`)
  console.log(`[Vortix WS] WebSocket SSH: ws://127.0.0.1:${PORT}/ws/ssh`)
  console.log(`[Vortix WS] WebSocket SFTP: ws://127.0.0.1:${PORT}/ws/sftp`)
})
