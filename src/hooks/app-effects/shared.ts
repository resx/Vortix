import { emit, emitTo } from '@tauri-apps/api/event'
import {
  useSettingsStore,
  buildSyncVerificationSignature,
  hashSyncSignature,
  SYNC_VERIFIED_SIGNATURE_HASH_KEY,
} from '../../stores/useSettingsStore'
import { useAssetStore } from '../../stores/useAssetStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { loadLocale } from '../../i18n'

export function isSyncSignatureVerified(): boolean {
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

export async function refreshActiveSidebarList(): Promise<void> {
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
