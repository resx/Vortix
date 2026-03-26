import { useCallback, useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useThemeEffect, useUIFontEffect } from '../../hooks/useAppEffects'
import { shouldBlockTabFocusNavigation } from '../../lib/focus-tab-policy'
import { loadLocale } from '../../i18n'
import TermThemePanel from '../settings/TermThemePanel'

export default function ThemeManagerWindow() {
  const [ready, setReady] = useState(false)
  const loadSettings = useSettingsStore((s) => s.loadSettings)

  useEffect(() => {
    loadSettings()
      .then(() => {
        const lang = useSettingsStore.getState().language
        return Promise.all([
          useTerminalProfileStore.getState().loadProfiles().catch(() => {}),
          useThemeStore.getState().loadCustomThemes().catch(() => {}),
          loadLocale(lang).catch(() => {}),
        ])
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [loadSettings])

  useEffect(() => {
    if (!ready) return
    if (!('__TAURI_INTERNALS__' in window)) return
    requestAnimationFrame(() => {
      const win = getCurrentWindow()
      win.show().then(() => win.setFocus())
    })
  }, [ready])

  useEffect(() => {
    const unlisten = listen<{ source?: string }>('config-changed', (event) => {
      if (event.payload?.source === 'theme-manager') return
      void loadSettings()
        .then(() => {
          const lang = useSettingsStore.getState().language
          return Promise.all([
            useTerminalProfileStore.getState().loadProfiles().catch(() => {}),
            useThemeStore.getState().loadCustomThemes().catch(() => {}),
            loadLocale(lang).catch(() => {}),
          ])
        })
        .catch(() => {})
    })
    return () => { unlisten.then(fn => fn()) }
  }, [loadSettings])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldBlockTabFocusNavigation(event)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useThemeEffect()
  useUIFontEffect()

  const handleCloseWindow = useCallback(async () => {
    if (!('__TAURI_INTERNALS__' in window)) {
      window.close()
      return
    }

    const win = getCurrentWindow()
    try {
      await win.close()
      await new Promise((resolve) => window.setTimeout(resolve, 80))
      const stillVisible = await win.isVisible().catch(() => false)
      if (!stillVisible) return
    } catch {
      // fallback below
    }

    try {
      await win.hide()
      return
    } catch {
      // fallback below
    }

    const maybeDestroy = win as unknown as { destroy?: () => Promise<void> }
    if (typeof maybeDestroy.destroy === 'function') {
      await maybeDestroy.destroy().catch(() => {})
    }
  }, [])

  if (!ready) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-base text-text-3">
        加载中...
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden p-2 bg-[radial-gradient(circle_at_12%_0%,rgba(64,128,255,0.16),rgba(243,246,250,0.96)_42%),radial-gradient(circle_at_88%_100%,rgba(103,194,58,0.12),rgba(243,246,250,0.96)_38%)] dark:bg-[radial-gradient(circle_at_12%_0%,rgba(91,143,255,0.2),rgba(16,18,23,0.96)_42%),radial-gradient(circle_at_88%_100%,rgba(64,128,255,0.16),rgba(16,18,23,0.96)_40%)]">
      <TermThemePanel isOpen onClose={handleCloseWindow} windowMode />
    </div>
  )
}
