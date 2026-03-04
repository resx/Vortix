/* ── Express App 实例 + 中间件注册 ── */

import express from 'express'
import cors from 'cors'
import { errorHandler } from './middleware/error.js'
import healthRoutes from './routes/health.routes.js'
import foldersRoutes from './routes/folders.routes.js'
import connectionsRoutes from './routes/connections.routes.js'
import settingsRoutes from './routes/settings.routes.js'
import historyRoutes from './routes/history.routes.js'

const app = express()

// 中间件
app.use(cors())
app.use(express.json())

// API 路由
app.use('/api', healthRoutes)
app.use('/api', foldersRoutes)
app.use('/api', connectionsRoutes)
app.use('/api', settingsRoutes)
app.use('/api', historyRoutes)

// 统一错误处理
app.use(errorHandler)

export default app
