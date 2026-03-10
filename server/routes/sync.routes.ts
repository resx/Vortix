/* ── 云同步路由（多源支持） ── */

import { Router } from 'express'
import * as syncService from '../services/sync.service.js'
import * as autoSync from '../services/auto-sync.service.js'
import { createSyncProvider } from '../services/sync-providers/index.js'
import type { ProviderConfig } from '../services/sync-providers/types.js'
import type { ApiResponse, ImportResult, SyncConflictInfo } from '../types/index.js'
import type { SyncFileInfo } from '../services/sync-providers/types.js'

const router = Router()

/** 从请求体解析 ProviderConfig */
function parseProviderConfig(body: Record<string, unknown>): ProviderConfig {
  const source = body.repoSource as string
  switch (source) {
    case 'local': {
      const localPath = body.syncLocalPath as string
      if (!localPath || typeof localPath !== 'string') throw new Error('本地路径不能为空')
      return { type: 'local', path: localPath }
    }
    case 'git': {
      const url = body.syncGitUrl as string
      if (!url || typeof url !== 'string') throw new Error('Git 仓库地址不能为空')
      return {
        type: 'git',
        url,
        branch: (body.syncGitBranch as string) || 'master',
        path: 'Vortix',
        username: body.syncGitUsername as string | undefined,
        password: body.syncGitPassword as string | undefined,
        sshKey: body.syncGitSshKey as string | undefined,
        tlsVerify: body.syncTlsVerify !== false,
      }
    }
    case 'webdav': {
      const endpoint = body.syncWebdavEndpoint as string
      if (!endpoint || typeof endpoint !== 'string') throw new Error('WebDAV 地址不能为空')
      try { new URL(endpoint) } catch { throw new Error('WebDAV 地址格式无效') }
      return {
        type: 'webdav',
        endpoint,
        path: (body.syncWebdavPath as string) || 'vortix',
        username: body.syncWebdavUsername as string,
        password: body.syncWebdavPassword as string,
        tlsVerify: body.syncTlsVerify !== false,
      }
    }
    case 's3': {
      const endpoint = body.syncS3Endpoint as string
      if (!endpoint || typeof endpoint !== 'string') throw new Error('S3 地址不能为空')
      try { new URL(endpoint) } catch { throw new Error('S3 地址格式无效') }
      return {
        type: 's3',
        endpoint,
        path: (body.syncS3Path as string) || 'vortix',
        region: (body.syncS3Region as string) || 'us-east-1',
        bucket: body.syncS3Bucket as string,
        accessKey: body.syncS3AccessKey as string,
        secretKey: body.syncS3SecretKey as string,
        style: (body.syncS3Style as 'virtual-hosted' | 'path') || 'virtual-hosted',
        tlsVerify: body.syncTlsVerify !== false,
      }
    }
    default:
      throw new Error(`不支持的仓库源: ${source}`)
  }
}

// POST /sync/test — 连通性测试（不影响真实同步数据）
router.post('/sync/test', async (req, res) => {
  await autoSync.suspend()
  try {
    const pc = parseProviderConfig(req.body)
    const provider = createSyncProvider(pc)
    await provider.test()
    const body: ApiResponse = { success: true }
    res.json(body)
  } catch (e) {
    const body: ApiResponse = { success: false, error: (e as Error).message }
    res.status(500).json(body)
  } finally {
    autoSync.resume()
  }
})

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

// POST /sync/check-push — 推送前冲突检测
router.post('/sync/check-push', async (req, res) => {
  try {
    const pc = parseProviderConfig(req.body)
    const provider = createSyncProvider(pc)
    const info = await syncService.checkPushConflict(provider)
    const body: ApiResponse<SyncConflictInfo> = { success: true, data: info }
    res.json(body)
  } catch (e) {
    const body: ApiResponse = { success: false, error: (e as Error).message }
    res.status(500).json(body)
  }
})

// POST /sync/check-pull — 拉取前冲突检测
router.post('/sync/check-pull', async (req, res) => {
  try {
    const pc = parseProviderConfig(req.body)
    const provider = createSyncProvider(pc)
    const info = await syncService.checkPullConflict(provider)
    const body: ApiResponse<SyncConflictInfo> = { success: true, data: info }
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
