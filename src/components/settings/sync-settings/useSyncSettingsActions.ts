import { useCallback } from 'react'
import { reloadStateAfterSyncImport } from '../../../hooks/useAppEffects'
import * as api from '../../../api/client'
import type { ImportResult } from '../../../api/types'
import { useAssetStore } from '../../../stores/useAssetStore'
import { useShortcutStore } from '../../../stores/useShortcutStore'
import { useToastStore } from '../../../stores/useToastStore'
import { useUIStore } from '../../../stores/useUIStore'
import type { SyncSettingsActions, SyncSettingsState } from './sync-settings-types'

export function useSyncSettingsActions(state: SyncSettingsState): SyncSettingsActions {
  const addToast = useToastStore((store) => store.addToast)
  const setSyncRemoteAvailable = useUIStore((store) => store.setSyncRemoteAvailable)

  const handleTest = useCallback(async () => {
    if (state.repoSource === 'local' && !state.syncLocalPath.trim()) {
      addToast('error', '请先选择同步目录')
      return
    }
    if (state.repoSource === 'git' && !state.gitUrl.trim()) {
      addToast('error', '请先填写仓库地址')
      return
    }
    if (state.repoSource === 'webdav' && !state.webdavEndpoint.trim()) {
      addToast('error', '请先填写 WebDAV Endpoint')
      return
    }
    if (state.repoSource === 's3' && !state.s3Endpoint.trim()) {
      addToast('error', '请先填写 S3 Endpoint')
      return
    }

    state.setTesting(true)
    state.setConnectionHint('')
    try {
      await api.syncTest(state.syncBody)
      state.setConnectionState('ok')
      state.persistVerifiedSignature(true)
      addToast('success', state.repoSource === 'local' ? '目录可用' : '连接测试成功')
    } catch (error) {
      state.setConnectionState('error')
      state.setFileInfo(null)
      state.persistVerifiedSignature(false)
      state.setConnectionHint((error as Error).message)
      addToast('error', (error as Error).message)
    } finally {
      state.setTesting(false)
    }
  }, [addToast, state])

  const handleExport = useCallback(async (force = false) => {
    if (state.connectionState !== 'ok') {
      addToast('error', '请先完成连接测试')
      return
    }
    if (state.repoSource === 'local' && !state.syncLocalPath.trim()) {
      addToast('error', '请先选择同步目录')
      return
    }

    state.setSyncing(true)
    state.setConnectionHint('')
    try {
      if (!force) {
        const conflict = await api.checkPushConflict(state.syncBody)
        if (conflict.hasConflict) {
          state.setConflictInfo({ info: conflict, action: 'push' })
          state.setSyncing(false)
          return
        }
      }
      await api.syncExport(state.syncBody)
      setSyncRemoteAvailable(false)
      await state.refreshFileInfo()
      state.setConnectionState('ok')
      addToast('success', '导出完成')
    } catch (error) {
      state.setConnectionState('error')
      state.setConnectionHint((error as Error).message)
      addToast('error', (error as Error).message)
    } finally {
      state.setSyncing(false)
    }
  }, [addToast, setSyncRemoteAvailable, state])

  const handleImport = useCallback(async (force = false) => {
    if (state.connectionState !== 'ok') {
      addToast('error', '请先完成连接测试')
      return
    }
    if (state.repoSource === 'local' && !state.syncLocalPath.trim()) {
      addToast('error', '请先选择同步目录')
      return
    }

    state.setSyncing(true)
    state.setConfirmImport(false)
    state.setConnectionHint('')
    try {
      if (!force) {
        const conflict = await api.checkPullConflict(state.syncBody)
        if (conflict.hasConflict) {
          state.setConflictInfo({ info: conflict, action: 'pull' })
          state.setSyncing(false)
          return
        }
      }
      const result: ImportResult = await api.syncImport(state.syncBody)
      state.setConnectionState('ok')
      addToast(
        'success',
        `导入完成：${result.folders} 个文件夹，${result.connections} 个连接，${result.shortcuts} 个快捷键，${result.sshKeys} 个 SSH 密钥`,
      )
      await reloadStateAfterSyncImport('settings-sync-import')
    } catch (error) {
      state.setConnectionState('error')
      state.setConnectionHint((error as Error).message)
      addToast('error', (error as Error).message)
    } finally {
      state.setSyncing(false)
    }
  }, [addToast, state])

  const handleConflictUseLocal = useCallback(() => {
    state.setConflictInfo(null)
    void handleExport(true)
  }, [handleExport, state])

  const handleConflictUseRemote = useCallback(() => {
    state.setConflictInfo(null)
    void handleImport(true)
  }, [handleImport, state])

  const handleDeleteRemote = useCallback(async () => {
    state.setSyncing(true)
    state.setConfirmDeleteRemote(false)
    state.setConnectionHint('')
    try {
      await api.deleteSyncRemote(state.syncBody)
      state.setConnectionState('ok')
      setSyncRemoteAvailable(false)
      state.setFileInfo(null)
      addToast('success', state.repoSource === 'local' ? '同步目录已清空' : '远端同步包已删除')
    } catch (error) {
      state.setConnectionState('error')
      state.setConnectionHint((error as Error).message)
      addToast('error', (error as Error).message)
    } finally {
      state.setSyncing(false)
    }
  }, [addToast, setSyncRemoteAvailable, state])

  const handlePurgeAllData = useCallback(async () => {
    try {
      await api.purgeAllData()
      await useAssetStore.getState().fetchAssets()
      await useShortcutStore.getState().fetchShortcuts()
      addToast('success', '本地数据已清空')
    } catch (error) {
      addToast('error', (error as Error).message)
    } finally {
      state.setConfirmClear(false)
    }
  }, [addToast, state])

  const handlePickLocalDir = useCallback(async () => {
    state.setPickingDir(true)
    try {
      const selected = await api.pickDir(state.syncLocalPath || undefined)
      if (selected) {
        state.update('syncLocalPath', selected)
      }
    } catch {
      // ignore
    } finally {
      state.setPickingDir(false)
    }
  }, [state])

  const handlePickGitSshKeyFile = useCallback(async () => {
    try {
      const result = await api.pickFile('选择 SSH 密钥文件', '私钥文件|*.pem;*.key;*.ppk;*.pub|所有文件|*.*')
      if (result.content) {
        state.update('syncGitSshKey', result.content.trim())
        state.update('syncGitSshKeyLabel', '')
        state.update('syncGitSshKeyMode', 'manual')
      }
    } catch {
      // ignore
    }
  }, [state])

  return {
    handleTest,
    handleExport,
    handleImport,
    handleConflictUseLocal,
    handleConflictUseRemote,
    handleDeleteRemote,
    handlePurgeAllData,
    handlePickLocalDir,
    handlePickGitSshKeyFile,
  }
}
