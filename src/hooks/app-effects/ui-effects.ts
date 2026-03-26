import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { resolveFontChain } from '../../lib/fonts'
import { refreshActiveSidebarList } from './shared'

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
    events.forEach((event) => window.addEventListener(event, handler, { passive: true }))
    resetTimer()

    return () => {
      if (timer) clearTimeout(timer)
      events.forEach((event) => window.removeEventListener(event, handler))
    }
  }, [])
}

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
    return () => { unlisten.then((fn) => fn()) }
  }, [])
}

export function useThemeEffect() {
  const theme = useSettingsStore((state) => state.theme)

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

export function useUIFontEffect() {
  const uiFontFamily = useSettingsStore((state) => state.uiFontFamily)
  useEffect(() => {
    if (uiFontFamily.length === 0 || (uiFontFamily.length === 1 && uiFontFamily[0] === 'system')) {
      document.body.style.fontFamily = ''
    } else {
      document.body.style.fontFamily = resolveFontChain(uiFontFamily, 'system-ui, -apple-system, sans-serif')
    }
  }, [uiFontFamily])
}

export function useZoomEffect() {
  const uiZoom = useSettingsStore((state) => state.uiZoom)
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

export function useAnimationEffect() {
  const enableAnimation = useSettingsStore((state) => state.enableAnimation)
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !enableAnimation)
  }, [enableAnimation])
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const shouldBlockReload = event.key === 'F5' || ((event.ctrlKey || event.metaKey) && key === 'r')
      if (shouldBlockReload) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        void refreshActiveSidebarList()
        return
      }

      const isDevtoolsHotkey =
        event.key === 'F12'
        || ((event.ctrlKey && event.shiftKey) && (key === 'i' || key === 'j' || event.code === 'KeyI' || event.code === 'KeyJ'))
        || ((event.metaKey && event.altKey) && (key === 'i' || event.code === 'KeyI'))

      if (isDevtoolsHotkey && !useSettingsStore.getState().debugMode) {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        return
      }

      if (event.ctrlKey && event.shiftKey && event.key === 'F') {
        event.preventDefault()
        useUIStore.getState().toggleQuickSearch()
      }
      if (event.ctrlKey && !event.shiftKey && event.key === 'w') {
        if ((event.target as HTMLElement).closest?.('.terminal-container')) return
        event.preventDefault()
        const { activeTabId, closeTab } = useTabStore.getState()
        if (activeTabId !== 'list') closeTab(activeTabId)
      }
      if (event.ctrlKey && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
        event.preventDefault()
      }
      if (event.ctrlKey && !event.shiftKey && (event.key === '=' || event.key === '+' || event.key === '-' || event.key === '0')) {
        event.preventDefault()
        const { termZoomEnabled, uiZoom, updateSetting } = useSettingsStore.getState()
        if (!termZoomEnabled) return
        const step = 5
        if (event.key === '0') {
          if (uiZoom !== 100) updateSetting('uiZoom', 100)
        } else if (event.key === '=' || event.key === '+') {
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
    const handler = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      if ((event.target as HTMLElement).closest?.('.terminal-container')) return
      event.preventDefault()
      const { termZoomEnabled, uiZoom, updateSetting } = useSettingsStore.getState()
      if (!termZoomEnabled) return
      const step = 5
      const next = event.deltaY < 0 ? Math.min(200, uiZoom + step) : Math.max(50, uiZoom - step)
      if (next !== uiZoom) updateSetting('uiZoom', next)
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [])
}

export function useWindowReady(): void {
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return
    requestAnimationFrame(() => {
      const win = getCurrentWindow()
      win.show().then(() => win.setFocus())
    })
  }, [])
}
