/* ── App 全局副作用 hooks ── */

import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useAssetStore } from '../stores/useAssetStore'
import { useShortcutStore } from '../stores/useShortcutStore'
import { useTerminalProfileStore } from '../stores/useTerminalProfileStore'
import { useTabStore } from '../stores/useTabStore'
import { useUIStore } from '../stores/useUIStore'
import { resolveFontChain } from '../lib/fonts'
import { loadLocale } from '../i18n'
import type { AssetRow } from '../types'

/** 初始化：加载设置、资产、快捷命令、恢复标签页 */
export function useAppInit() {
  useEffect(() => {
    Promise.all([
      useSettingsStore.getState().loadSettings(),
      useAssetStore.getState().fetchAssets(),
      useShortcutStore.getState().fetchShortcuts(),
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
        const lang = useSettingsStore.getState().language
        loadLocale(lang)
      })
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

    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => {
        root.classList.add('theme-switching')
        if (mq.matches) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
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
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) {
        e.preventDefault()
      }
      if (e.key === 'F12' && !useSettingsStore.getState().debugMode) {
        e.preventDefault()
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
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
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
