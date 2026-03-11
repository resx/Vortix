/* ── Express App 实例 + 中间件注册 ── */

import express from 'express'
import cors from 'cors'
import { errorHandler } from './middleware/error.js'
import healthRoutes from './routes/health.routes.js'
import foldersRoutes from './routes/folders.routes.js'
import connectionsRoutes from './routes/connections.routes.js'
import settingsRoutes from './routes/settings.routes.js'
import historyRoutes from './routes/history.routes.js'
import fsRoutes from './routes/fs.routes.js'
import logsRoutes from './routes/logs.routes.js'
import shortcutsRoutes from './routes/shortcuts.routes.js'
import syncRoutes from './routes/sync.routes.js'
import sshKeysRoutes from './routes/sshkeys.routes.js'
import presetsRoutes from './routes/presets.routes.js'

const app = express()

// 中间件
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'],
}))
app.use(express.json({ limit: '5mb' }))

// API 路由
app.use('/api', healthRoutes)
app.use('/api', foldersRoutes)
app.use('/api', connectionsRoutes)
app.use('/api', settingsRoutes)
app.use('/api', historyRoutes)
app.use('/api', fsRoutes)
app.use('/api', logsRoutes)
app.use('/api', shortcutsRoutes)
app.use('/api', syncRoutes)
app.use('/api', sshKeysRoutes)
app.use('/api', presetsRoutes)

// 统一错误处理
app.use(errorHandler)

export default app
