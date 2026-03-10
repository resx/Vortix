/* ── 服务器启动入口 ── */

import http from 'http'
import app from './app.js'
import { migrateToJson } from './db/migrate-to-json.js'
import { initStores } from './db/stores.js'
import { setupWebSocket } from './ws/ssh.handler.js'
import * as autoSync from './services/auto-sync.service.js'

// 从 SQLite 迁移到 JSON（首次升级时自动执行）
await migrateToJson()

// 初始化 JSON 存储
initStores()

// 创建 HTTP 服务器
const server = http.createServer(app)

// 挂载 WebSocket
const wss = setupWebSocket(server)

// 初始化自动同步（传入 WSS 用于冲突通知）
autoSync.init(wss)

// 启动监听
const PORT = Number(process.env.SSH_SERVER_PORT) || 3001

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Vortix SSH Server] 运行在 http://127.0.0.1:${PORT}`)
  console.log(`[Vortix API] REST API: http://127.0.0.1:${PORT}/api`)
  console.log(`[Vortix WS] WebSocket: ws://127.0.0.1:${PORT}/ws/ssh`)
})
