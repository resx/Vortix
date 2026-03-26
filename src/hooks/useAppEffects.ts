/* ── App 全局副作用 hooks ── */

import { useEffect, useRef } from 'react'
import { emit, emitTo, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  useSettingsStore,
  buildSyncBody,
  buildSyncVerificationSignature,
  hashSyncSignature,
  SYNC_VERIFIED_SIGNATURE_HASH_KEY,
} from '../stores/useSettingsStore'
import { useAssetStore } from '../stores/useAssetStore'
import { useShortcutStore } from '../stores/useShortcutStore'
import { useTerminalProfileStore } from '../stores/useTerminalProfileStore'
import { useThemeStore } from '../stores/useThemeStore'
import { useTabStore } from '../stores/useTabStore'
import { useUIStore } from '../stores/useUIStore'
import { useToastStore } from '../stores/useToastStore'
import { resolveFontChain } from '../lib/fonts'
import { loadLocale } from '../i18n'
import * as api from '../api/client'
import type { AssetRow } from '../types'

function isSyncSignatureVerified(): boolean {
  try {
    const state = useSettingsStore.getState()
    const signature = buildSyncVerificationSignature(state)
    const hash = hashSyncSignature(signature)
    return window.localStorage.getItem(SYNC_VERIFIED_SIGNATURE_HASH_KEY) === hash
  } catch {
    return false
  }
}

function isListTabActive(): boolean {
  const { activeTabId, tabs } = useTabStore.getState()
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  return activeTab?.type === 'list'
}

async function refreshActiveSidebarList(): Promise<void> {
  if (!isListTabActive()) return
  const { activeFilter } = useAssetStore.getState()
  if (activeFilter === 'shortcuts') {
    await useShortcutStore.getState().fetchShortcuts()
    return
  }
  await useAssetStore.getState().fetchAssets()
}

export async function reloadStateAfterSyncImport(source = 'sync-import'): Promise<void> {
  await Promise.all([
    useSettingsStore.getState().loadSettings(),
    useAssetStore.getState().fetchAssets(),
    useShortcutStore.getState().fetchShortcuts(),
    useTerminalProfileStore.getState().loadProfiles().catch(() => {}),
    useThemeStore.getState().loadCustomThemes().catch(() => {}),
  ])

  const lang = useSettingsStore.getState().language
  await loadLocale(lang).catch(() => {})
  useUIStore.getState().setSyncRemoteAvailable(false)

  if (!('__TAURI_INTERNALS__' in window)) return

  const payload = { source }
  await emit('config-changed', payload).catch(() => {})
  await Promise.allSettled([
    emitTo('main', 'config-changed', payload),
    emitTo('settings', 'config-changed', payload),
    emitTo('theme-manager', 'config-changed', payload),
    emitTo('main', 'sync-data-imported', payload),
    emitTo('settings', 'sync-data-imported', payload),
    emitTo('theme-manager', 'sync-data-imported', payload),
  ])
}

/** 初始化：加载设置、资产、快捷命令、恢复标签页 */
export function useAppInit() {
  useEffect(() => {
    Promise.all([
      useSettingsStore.getState().loadSettings(),
      useAssetStore.getState().fetchAssets(),
      useShortcutStore.getState().fetchShortcuts(),
      useThemeStore.getState().loadCustomThemes().catch(() => {}),
    ]).then(() => {
      useTerminalProfileStore.getState().loadProfiles()
      const lang = useSettingsStore.getState().language
      loadLocale(lang)

      // restoreSession：从 localStorage 恢复上次的标签页状态
      const settings = useSettingsStore.getState()
      if (settings.restoreSession) {
        const saved = localStorage.getItem('vortix-tab-state')
        if (saved) {
          useTabStore.getState().restoreTabState(saved)
        }
      }

      // lockOnStart：启动时锁屏（需要已设置密码）
      if (settings.lockOnStart && settings.lockPassword) {
        useUIStore.getState().setLocked(true)
      }
    })

    // 检测 URL 参数 ?restore= 恢复标签页状态
    const params = new URLSearchParams(window.location.search)
    const restoreData = params.get('restore')
    if (restoreData) {
      try {
        if (restoreData.length > 50000) throw new Error('restore data too large')
        const state = JSON.parse(restoreData)
        if (state.tabs && Array.isArray(state.tabs) && state.tabs.length <= 50) {
          for (const tab of state.tabs) {
            if (tab.type === 'asset' && tab.assetRow && typeof tab.assetRow.id === 'string' && typeof tab.assetRow.name === 'string') {
              useTabStore.getState().openAssetTab(tab.assetRow)
            }
          }
        }
      } catch {
        // 解析失败静默忽略
      }
      window.history.replaceState({}, '', window.location.pathname)
    }

    // 检测 URL 参数 ?connect= 直接打开连接
    const connectId = params.get('connect')
    if (connectId) {
      Promise.all([
        useSettingsStore.getState().loadSettings(),
        useAssetStore.getState().fetchAssets(),
      ]).then(() => {
        const row = useAssetStore.getState().tableData.find(
          (r) => r.type === 'asset' && r.id === connectId
        )
        if (row) {
          useTabStore.getState().openAssetTab(row)
        } else {
          // 动态导入避免污染设置窗口的模块图
          import('../api/client').then(({ getConnection }) => {
            getConnection(connectId).then((conn) => {
              const assetRow: AssetRow = {
                id: conn.id,
                name: conn.name,
                type: 'asset',
                protocol: conn.protocol,
                colorTag: conn.color_tag,
                latency: '-',
                host: conn.host,
                user: conn.username,
                created: '',
                expire: '',
                remark: conn.remark ?? '',
                folderId: conn.folder_id,
              }
              useTabStore.getState().openAssetTab(assetRow)
            }).catch(() => {
              // 连接不存在，静默忽略
            })
          })
        }
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])
}

/** 标签页状态持久化：restoreSession 开启时自动保存到 localStorage */
export function useTabStatePersistence() {
  useEffect(() => {
    const unsub = useTabStore.subscribe((s, prev) => {
      if (s.tabs === prev.tabs && s.activeTabId === prev.activeTabId) return
      if (!useSettingsStore.getState().restoreSession) return
      try {
        localStorage.setItem('vortix-tab-state', useTabStore.getState().serializeTabState())
      } catch { /* 存储满时静默 */ }
    })
    return () => unsub()
  }, [])
}

/** 空闲锁屏：idleLockMinutes > 0 且已设置密码时，空闲超时自动锁屏 */
export function useIdleLock() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const resetTimer = () => {
      if (timer) clearTimeout(timer)
      const { idleLockMinutes, lockPassword } = useSettingsStore.getState()
      if (idleLockMinutes <= 0 || !lockPassword) return
      timer = setTimeout(() => {
        const { isLocked } = useUIStore.getState()
        if (!isLocked) useUIStore.getState().setLocked(true)
      }, idleLockMinutes * 60 * 1000)
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const
    const handler = () => resetTimer()
    events.forEach(e => window.addEventListener(e, handler, { passive: true }))
    resetTimer()

    return () => {
      if (timer) clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, handler))
    }
  }, [])
}

/** 窗口大小与最大化状态 */
export function useWindowSizeEffect() {
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return
    const win = getCurrentWindow()
    const update = async () => {
      const isMaximized = await win.isMaximized()
      const isFullscreen = await win.isFullscreen()
      document.documentElement.classList.toggle('is-maximized', isMaximized || isFullscreen)
    }
    const unlisten = win.onResized(update)
    update()
    return () => { unlisten.then(fn => fn()) }
  }, [])
}

/** 跨窗口配置变更监听 */
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
    return () => { unlisten.then(fn => fn()) }
  }, [])
}

/** ??????? */
export function useSyncDataImportedListener() {
  useEffect(() => {
    const unlisten = listen('sync-data-imported', async () => {
      await Promise.all([
        useAssetStore.getState().fetchAssets(),
        useShortcutStore.getState().fetchShortcuts(),
      ])
      useUIStore.getState().setSyncRemoteAvailable(false)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])
}

/** 自动同步: 拆分为两层 —— dirty push（30s）+ remote check（可配置间隔） */
export function useAutoSyncEffect() {
  const loaded = useSettingsStore((s) => s._loaded)
  const autoSync = useSettingsStore((s) => s.syncAutoSync)
  const repoSource = useSettingsStore((s) => s.syncRepoSource)
  const syncLocalPath = useSettingsStore((s) => s.syncLocalPath)
  const syncGitUrl = useSettingsStore((s) => s.syncGitUrl)
  const syncWebdavEndpoint = useSettingsStore((s) => s.syncWebdavEndpoint)
  const syncS3Endpoint = useSettingsStore((s) => s.syncS3Endpoint)
  const syncCheckInterval = useSettingsStore((s) => s.syncCheckInterval)
  const syncConflictOpen = useUIStore((s) => s.syncConflictOpen)
  const addToast = useToastStore((s) => s.addToast)

  const isConfigured = (
    (repoSource === 'local' && !!syncLocalPath.trim()) ||
    (repoSource === 'git' && !!syncGitUrl.trim()) ||
    (repoSource === 'webdav' && !!syncWebdavEndpoint.trim()) ||
    (repoSource === 's3' && !!syncS3Endpoint.trim())
  )

  // ── 层 1: dirty push（本地有变更时推送，30s 间隔）──
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
      } catch (e) {
        const now = Date.now()
        if (now - lastErrorAt > 60000) {
          lastErrorAt = now
          addToast('error', `自动同步失败: ${(e as Error).message || '未知错误'}`)
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

  // ── 层 2: remote check（轻量级远端变更检测，可配置间隔，默认 15min）──
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
      } catch { /* 静默 */ }
      if (!disposed) {
        timer = setTimeout(check, intervalMs)
      }
    }

    // 启动后延迟 5s 执行首次检测
    timer = setTimeout(check, 5000)
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
    }
  }, [loaded, autoSync, repoSource, isConfigured, syncCheckInterval])
}

/** 窗口重获焦点时轻量检测远端变更（防抖 5 分钟） */
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
      } catch { /* 静默 */ }
    })

    return () => { unlisten.then(fn => fn()) }
  }, [])
}

/** 主题切换 */
export function useThemeEffect() {
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('theme-switching')
    const syncResolvedMode = (mode: 'light' | 'dark') => {
      root.classList.add('theme-switching')
      root.classList.toggle('dark', mode === 'dark')
      useThemeStore.getState().setRuntimeMode(mode)
    }

    if (theme === 'dark') {
      syncResolvedMode('dark')
    } else if (theme === 'light') {
      syncResolvedMode('light')
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => {
        syncResolvedMode(mq.matches ? 'dark' : 'light')
        requestAnimationFrame(() => {
          requestAnimationFrame(() => root.classList.remove('theme-switching'))
        })
      }
      apply()
      mq.addEventListener('change', apply)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => root.classList.remove('theme-switching'))
      })
      return () => mq.removeEventListener('change', apply)
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove('theme-switching'))
    })
  }, [theme])
}

/** UI 字体 */
export function useUIFontEffect() {
  const uiFontFamily = useSettingsStore((s) => s.uiFontFamily)
  useEffect(() => {
    if (uiFontFamily.length === 0 || (uiFontFamily.length === 1 && uiFontFamily[0] === 'system')) {
      document.body.style.fontFamily = ''
    } else {
      document.body.style.fontFamily = resolveFontChain(uiFontFamily, 'system-ui, -apple-system, sans-serif')
    }
  }, [uiFontFamily])
}

/** 缩放比例 */
export function useZoomEffect() {
  const uiZoom = useSettingsStore((s) => s.uiZoom)
  useEffect(() => {
    const el = document.body
    const factor = uiZoom / 100
    if (factor === 1) {
      el.style.transform = ''
      el.style.transformOrigin = ''
      el.style.width = ''
      el.style.height = ''
    } else {
      el.style.transformOrigin = '0 0'
      el.style.transform = `scale(${factor})`
      el.style.width = `${100 / factor}vw`
      el.style.height = `${100 / factor}vh`
    }
  }, [uiZoom])
}

/** 动画开关 */
export function useAnimationEffect() {
  const enableAnimation = useSettingsStore((s) => s.enableAnimation)
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !enableAnimation)
  }, [enableAnimation])
}

/** 全局快捷键 + Ctrl+Scroll 缩放 */
export function useGlobalShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const shouldBlockReload =
        e.key === 'F5' || ((e.ctrlKey || e.metaKey) && key === 'r')
      if (shouldBlockReload) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        void refreshActiveSidebarList()
        return
      }

      const isDevtoolsHotkey =
        e.key === 'F12'
        || ((e.ctrlKey && e.shiftKey) && (key === 'i' || key === 'j' || e.code === 'KeyI' || e.code === 'KeyJ'))
        || ((e.metaKey && e.altKey) && (key === 'i' || e.code === 'KeyI'))

      if (isDevtoolsHotkey && !useSettingsStore.getState().debugMode) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        return
      }

      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        useUIStore.getState().toggleQuickSearch()
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'w') {
        // 终端聚焦时不拦截 Ctrl+W（bash 删除前一个单词）
        if ((e.target as HTMLElement).closest?.('.terminal-container')) return
        e.preventDefault()
        const { activeTabId, closeTab } = useTabStore.getState()
        if (activeTabId !== 'list') closeTab(activeTabId)
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault()
      }
      if (e.ctrlKey && !e.shiftKey && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '0')) {
        e.preventDefault()
        const { termZoomEnabled, uiZoom, updateSetting } = useSettingsStore.getState()
        if (!termZoomEnabled) return
        const step = 5
        if (e.key === '0') {
          if (uiZoom !== 100) updateSetting('uiZoom', 100)
        } else if (e.key === '=' || e.key === '+') {
          const next = Math.min(200, uiZoom + step)
          if (next !== uiZoom) updateSetting('uiZoom', next)
        } else {
          const next = Math.max(50, uiZoom - step)
          if (next !== uiZoom) updateSetting('uiZoom', next)
        }
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [])

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      if ((e.target as HTMLElement).closest?.('.terminal-container')) return
      e.preventDefault()
      const { termZoomEnabled, uiZoom, updateSetting } = useSettingsStore.getState()
      if (!termZoomEnabled) return
      const step = 5
      const next = e.deltaY < 0 ? Math.min(200, uiZoom + step) : Math.max(50, uiZoom - step)
      if (next !== uiZoom) updateSetting('uiZoom', next)
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [])
}

/**
 * 窗口就绪后显示：配合 createWindow 的 visible:false 消除白屏闪烁。
 * 在组件首次渲染后调用 show() + setFocus()，确保 HTML/CSS/JS 已加载。
 */
export function useWindowReady(): void {
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return
    // requestAnimationFrame 确保首帧已绘制
    requestAnimationFrame(() => {
      const win = getCurrentWindow()
      win.show().then(() => win.setFocus())
    })
  }, [])
}
