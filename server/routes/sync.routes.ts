/* ── 云同步路由（多源支持） ── */

import { Router } from 'express'
import * as syncService from '../services/sync.service.js'
import { createSyncProvider } from '../services/sync-providers/index.js'
import type { ProviderConfig } from '../services/sync-providers/types.js'
import type { ApiResponse, ImportResult } from '../types/index.js'
import type { SyncFileInfo } from '../services/sync-providers/types.js'

const router = Router()

/** 从请求体解析 ProviderConfig */
function parseProviderConfig(body: Record<string, unknown>): ProviderConfig {
  const source = body.repoSource as string
  switch (source) {
    case 'local':
      return { type: 'local', path: body.syncLocalPath as string }
    case 'git':
      return {
        type: 'git',
        url: body.syncGitUrl as string,
        branch: (body.syncGitBranch as string) || 'master',
        path: 'Vortix',
        username: body.syncGitUsername as string | undefined,
        password: body.syncGitPassword as string | undefined,
        sshKey: body.syncGitSshKey as string | undefined,
        tlsVerify: body.syncTlsVerify !== false,
      }
    case 'webdav':
      return {
        type: 'webdav',
        endpoint: body.syncWebdavEndpoint as string,
        path: (body.syncWebdavPath as string) || 'vortix',
        username: body.syncWebdavUsername as string,
        password: body.syncWebdavPassword as string,
        tlsVerify: body.syncTlsVerify !== false,
      }
    case 's3':
      return {
        type: 's3',
        endpoint: body.syncS3Endpoint as string,
        path: (body.syncS3Path as string) || 'vortix',
        region: (body.syncS3Region as string) || 'us-east-1',
        bucket: body.syncS3Bucket as string,
        accessKey: body.syncS3AccessKey as string,
        secretKey: body.syncS3SecretKey as string,
        style: (body.syncS3Style as 'virtual-hosted' | 'path') || 'virtual-hosted',
        tlsVerify: body.syncTlsVerify !== false,
      }
    default:
      throw new Error(`不支持的仓库源: ${source}`)
  }
}

// POST /sync/export — 导出同步数据到指定源
router.post('/sync/export', async (req, res) => {
  try {
    const pc = parseProviderConfig(req.body)
    const provider = createSyncProvider(pc)
    const encryptionKey = (req.body.encryptionKey as string) || undefined
    await syncService.exportViaProvider(provider, encryptionKey)
    const body: ApiResponse = { success: true }
    res.json(body)
  } catch (e) {
    const body: ApiResponse = { success: false, error: (e as Error).message }
    res.status(500).json(body)
  }
})

// POST /sync/import — 从指定源导入同步数据
router.post('/sync/import', async (req, res) => {
  try {
    const pc = parseProviderConfig(req.body)
    const provider = createSyncProvider(pc)
    const encryptionKey = (req.body.encryptionKey as string) || undefined
    const result = await syncService.importViaProvider(provider, encryptionKey)
    const body: ApiResponse<ImportResult> = { success: true, data: result }
    res.json(body)
  } catch (e) {
    const body: ApiResponse = { success: false, error: (e as Error).message }
    res.status(500).json(body)
  }
})

// POST /sync/status — 查询同步文件状态（POST 因为需要传完整配置）
router.post('/sync/status', async (req, res) => {
  try {
    const pc = parseProviderConfig(req.body)
    const provider = createSyncProvider(pc)
    const info = await provider.status()
    const body: ApiResponse<SyncFileInfo> = { success: true, data: info }
    res.json(body)
  } catch (e) {
    const body: ApiResponse = { success: false, error: (e as Error).message }
    res.status(500).json(body)
  }
})

// DELETE /sync/remote — 删除远端同步文件
router.delete('/sync/remote', async (req, res) => {
  try {
    const pc = parseProviderConfig(req.body)
    const provider = createSyncProvider(pc)
    await provider.delete()
    const body: ApiResponse = { success: true }
    res.json(body)
  } catch (e) {
    const body: ApiResponse = { success: false, error: (e as Error).message }
    res.status(500).json(body)
  }
})

// POST /maintenance/purge-all — 清空所有本地业务数据
router.post('/maintenance/purge-all', (_req, res) => {
  try {
    syncService.purgeAllData()
    const body: ApiResponse = { success: true }
    res.json(body)
  } catch (e) {
    const body: ApiResponse = { success: false, error: (e as Error).message }
    res.status(500).json(body)
  }
})

export default router
