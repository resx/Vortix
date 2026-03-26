import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useSettingsStore, buildSyncBody } from '../../stores/useSettingsStore'
import { useAssetStore } from '../../stores/useAssetStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useUIStore } from '../../stores/useUIStore'
import { useToastStore } from '../../stores/useToastStore'
import { loadLocale } from '../../i18n'
import * as api from '../../api/client'
import { isSyncSignatureVerified, reloadStateAfterSyncImport } from './shared'

export { reloadStateAfterSyncImport }

export function useConfigChangedListener() {
  useEffect(() => {
    const unlisten = listen('config-changed', () => {
      useSettingsStore.getState().loadSettings().then(() => {
        useTerminalProfileStore.getState().loadProfiles()
        useThemeStore.getState().loadCustomThemes().catch(() => {})
        const lang = useSettingsStore.getState().language
        loadLocale(lang)
      })
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [])
}

export function useSyncDataImportedListener() {
  useEffect(() => {
    const unlisten = listen('sync-data-imported', async () => {
      await Promise.all([
        useAssetStore.getState().fetchAssets(),
        useShortcutStore.getState().fetchShortcuts(),
      ])
      useUIStore.getState().setSyncRemoteAvailable(false)
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [])
}

export function useAutoSyncEffect() {
  const loaded = useSettingsStore((state) => state._loaded)
  const autoSync = useSettingsStore((state) => state.syncAutoSync)
  const repoSource = useSettingsStore((state) => state.syncRepoSource)
  const syncLocalPath = useSettingsStore((state) => state.syncLocalPath)
  const syncGitUrl = useSettingsStore((state) => state.syncGitUrl)
  const syncWebdavEndpoint = useSettingsStore((state) => state.syncWebdavEndpoint)
  const syncS3Endpoint = useSettingsStore((state) => state.syncS3Endpoint)
  const syncCheckInterval = useSettingsStore((state) => state.syncCheckInterval)
  const syncConflictOpen = useUIStore((state) => state.syncConflictOpen)
  const addToast = useToastStore((state) => state.addToast)

  const isConfigured = (
    (repoSource === 'local' && !!syncLocalPath.trim()) ||
    (repoSource === 'git' && !!syncGitUrl.trim()) ||
    (repoSource === 'webdav' && !!syncWebdavEndpoint.trim()) ||
    (repoSource === 's3' && !!syncS3Endpoint.trim())
  )

  useEffect(() => {
    if (!loaded || !autoSync || repoSource === 'local' || !isConfigured || !isSyncSignatureVerified()) return

    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let running = false
    let lastErrorAt = 0
    let statusCheckedForDirtyCycle = false

    const schedule = (delayMs: number) => {
      if (disposed) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { void tick() }, delayMs)
    }

    const tick = async () => {
      if (disposed || running) {
        schedule(5000)
        return
      }
      running = true
      try {
        if (useUIStore.getState().syncConflictOpen) {
          schedule(5000)
          return
        }

        const localState = await api.getSyncLocalState()
        if (!localState.localDirty) {
          statusCheckedForDirtyCycle = false
          schedule(30000)
          return
        }

        const body = buildSyncBody()
        if (!statusCheckedForDirtyCycle) {
          await api.getSyncStatus(body)
          statusCheckedForDirtyCycle = true
        }
        const conflict = await api.checkPushConflict(body)
        if (conflict.hasConflict) {
          useUIStore.getState().openSyncConflict({ info: conflict, action: 'push', body })
          schedule(30000)
          return
        }

        await api.syncExport(body)
        useUIStore.getState().setSyncRemoteAvailable(false)
        schedule(30000)
      } catch (error) {
        const now = Date.now()
        if (now - lastErrorAt > 60000) {
          lastErrorAt = now
          addToast('error', `自动同步失败: ${(error as Error).message || '未知错误'}`)
        }
        schedule(30000)
      } finally {
        running = false
      }
    }

    schedule(3000)
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
    }
  }, [loaded, autoSync, repoSource, isConfigured, syncConflictOpen, addToast])

  useEffect(() => {
    if (!loaded || !autoSync || repoSource === 'local' || !isConfigured || !isSyncSignatureVerified()) return

    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const intervalMs = Math.max(1, syncCheckInterval) * 60 * 1000

    const check = async () => {
      if (disposed) return
      try {
        const body = buildSyncBody()
        const result = await api.checkRemoteChanged(body)
        useUIStore.getState().setSyncRemoteAvailable(result.hasUpdate)
      } catch {
        // ignore polling errors
      }
      if (!disposed) {
        timer = setTimeout(check, intervalMs)
      }
    }

    timer = setTimeout(check, 5000)
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
    }
  }, [loaded, autoSync, repoSource, isConfigured, syncCheckInterval])
}

export function useWindowFocusSyncCheck() {
  const lastCheckRef = useRef(0)

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return

    const unlisten = listen('tauri://focus', async () => {
      const { syncAutoSync, syncRepoSource, syncGitUrl, syncWebdavEndpoint, syncS3Endpoint } = useSettingsStore.getState()
      if (!syncAutoSync || syncRepoSource === 'local') return

      const isConfigured = (
        (syncRepoSource === 'git' && !!syncGitUrl.trim()) ||
        (syncRepoSource === 'webdav' && !!syncWebdavEndpoint.trim()) ||
        (syncRepoSource === 's3' && !!syncS3Endpoint.trim())
      )
      if (!isConfigured) return
      if (!isSyncSignatureVerified()) return

      const now = Date.now()
      if (now - lastCheckRef.current < 5 * 60 * 1000) return
      lastCheckRef.current = now

      try {
        const body = buildSyncBody()
        const result = await api.checkRemoteChanged(body)
        useUIStore.getState().setSyncRemoteAvailable(result.hasUpdate)
      } catch {
        // ignore focus sync check errors
      }
    })

    return () => { unlisten.then((fn) => fn()) }
  }, [])
}
