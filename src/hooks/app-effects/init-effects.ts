import { useEffect } from 'react'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useAssetStore } from '../../stores/useAssetStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { loadLocale } from '../../i18n'
import type { AssetRow } from '../../types'

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

      const settings = useSettingsStore.getState()
      if (settings.restoreSession) {
        const saved = localStorage.getItem('vortix-tab-state')
        if (saved) {
          useTabStore.getState().restoreTabState(saved)
        }
      }

      if (settings.lockOnStart && settings.lockPassword) {
        useUIStore.getState().setLocked(true)
      }
    })

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
        // ignore invalid restore data
      }
      window.history.replaceState({}, '', window.location.pathname)
    }

    const connectId = params.get('connect')
    if (connectId) {
      Promise.all([
        useSettingsStore.getState().loadSettings(),
        useAssetStore.getState().fetchAssets(),
      ]).then(() => {
        const row = useAssetStore.getState().tableData.find(
          (asset) => asset.type === 'asset' && asset.id === connectId,
        )
        if (row) {
          useTabStore.getState().openAssetTab(row)
        } else {
          import('../../api/client').then(({ getConnection }) => {
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
            }).catch(() => {})
          })
        }
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])
}

export function useTabStatePersistence() {
  useEffect(() => {
    const unsub = useTabStore.subscribe((state, prev) => {
      if (state.tabs === prev.tabs && state.activeTabId === prev.activeTabId) return
      if (!useSettingsStore.getState().restoreSession) return
      try {
        localStorage.setItem('vortix-tab-state', useTabStore.getState().serializeTabState())
      } catch {
        // ignore storage failure
      }
    })
    return () => unsub()
  }, [])
}
