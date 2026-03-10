/* ── 自动同步服务：防抖推送 + 重试 + WebSocket 通知 ── */

import * as syncService from './sync.service.js'
import * as syncState from './sync-state.service.js'
import * as settingsRepo from '../repositories/settings.repository.js'
import { createSyncProvider } from './sync-providers/index.js'
import type { ProviderConfig } from './sync-providers/types.js'
import type { WebSocketServer } from 'ws'

let wss: WebSocketServer | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let retryCount = 0
let suspended = false
let running = false
const MAX_RETRIES = 3
const RETRY_DELAYS = [10_000, 30_000, 60_000]
const DEBOUNCE_MS = 5_000

/** 初始化自动同步（传入 WebSocket 服务器实例） */
export function init(wsServer: WebSocketServer): void {
  wss = wsServer
}

/** 向所有前端 WebSocket 客户端广播消息 */
function broadcast(type: string, data?: unknown): void {
  if (!wss) return
  const msg = JSON.stringify({ type, data })
  for (const client of wss.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(msg)
    }
  }
}

/** 从设置中构建 Provider 配置 */
function buildProviderConfig(): ProviderConfig | null {
  const settings = settingsRepo.getAll()
  const source = settings.syncRepoSource as string
  if (!source) return null

  switch (source) {
    case 'local': {
      const p = settings.syncLocalPath as string
      if (!p) return null
      return { type: 'local', path: p }
    }
    case 'git': {
      const url = settings.syncGitUrl as string
      if (!url) return null
      return {
        type: 'git', url,
        branch: (settings.syncGitBranch as string) || 'master',
        path: 'Vortix',
        username: settings.syncGitUsername as string | undefined,
        password: settings.syncGitPassword as string | undefined,
        sshKey: settings.syncGitSshKey as string | undefined,
        tlsVerify: settings.syncTlsVerify !== false,
      }
    }
    case 'webdav': {
      const endpoint = settings.syncWebdavEndpoint as string
      if (!endpoint) return null
      return {
        type: 'webdav', endpoint,
        path: (settings.syncWebdavPath as string) || 'vortix',
        username: settings.syncWebdavUsername as string ?? '',
        password: settings.syncWebdavPassword as string ?? '',
        tlsVerify: settings.syncTlsVerify !== false,
      }
    }
    case 's3': {
      const endpoint = settings.syncS3Endpoint as string
      if (!endpoint) return null
      return {
        type: 's3', endpoint,
        path: (settings.syncS3Path as string) || 'vortix',
        region: (settings.syncS3Region as string) || 'us-east-1',
        bucket: (settings.syncS3Bucket as string) ?? '',
        accessKey: (settings.syncS3AccessKey as string) ?? '',
        secretKey: (settings.syncS3SecretKey as string) ?? '',
        style: ((settings.syncS3Style as string) || 'virtual-hosted') as 'virtual-hosted' | 'path',
        tlsVerify: settings.syncTlsVerify !== false,
      }
    }
    default: return null
  }
}

/** 执行一次自动推送 */
async function doAutoSync(): Promise<void> {
  if (suspended || running) return

  const settings = settingsRepo.getAll()
  if (!settings.syncAutoSync) return

  const config = buildProviderConfig()
  if (!config) return

  const encryptionKey = (settings.syncEncryptionKey as string) || undefined

  running = true
  try {
    const provider = createSyncProvider(config)

    // 自动同步：用户刚修改了本地数据，直接强制推送，跳过冲突检测
    // 冲突检测仅在手动推送/拉取时由前端触发
    await syncService.exportViaProvider(provider, encryptionKey)
    retryCount = 0
    console.log('[Vortix AutoSync] 自动同步完成')
  } catch (e) {
    const msg = (e as Error).message
    console.error('[Vortix AutoSync] 同步失败:', msg)

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount] ?? 60_000
      retryCount++
      console.log(`[Vortix AutoSync] 将在 ${delay / 1000}s 后重试 (${retryCount}/${MAX_RETRIES})`)
      setTimeout(doAutoSync, delay)
    } else {
      console.error('[Vortix AutoSync] 已达最大重试次数，放弃本次同步')
      retryCount = 0
    }
  } finally {
    running = false
  }
}

/** 暂停自动同步（取消待执行的定时器，等待进行中的同步完成） */
export async function suspend(): Promise<void> {
  suspended = true
  if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  // 等待正在执行的同步完成
  while (running) {
    await new Promise((r) => setTimeout(r, 100))
  }
}

/** 恢复自动同步 */
export function resume(): void {
  suspended = false
}

/** 标记数据变更并触发防抖同步 */
export function markDirty(): void {
  syncState.markDirty()

  if (suspended) return

  // 检查自动同步是否开启
  try {
    const settings = settingsRepo.getAll()
    if (!settings.syncAutoSync) return
  } catch { return }

  // 防抖：5 秒内多次变更合并为一次推送
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    retryCount = 0
    doAutoSync()
  }, DEBOUNCE_MS)
}
