import { create } from 'zustand'
import * as api from '../api/client'
import { loadLocale } from '../i18n'
import type { SyncRequestBody } from '../api/types'
import { DEFAULTS, TERM_APPEARANCE_KEYS } from './settings-store/defaults'
import { normalizeRemoteSettings } from './settings-store/normalize'
import type { SettingsState, SettingsStore } from './settings-store/types'
import {
  buildSyncBodyFromSettings,
  buildSyncVerificationSignature,
  hashSyncSignature,
  isSyncConfigured,
  SYNC_VERIFIED_SIGNATURE_HASH_KEY,
} from './settings-store/sync'

export type { SettingsState }
export {
  buildSyncVerificationSignature,
  hashSyncSignature,
  isSyncConfigured,
  SYNC_VERIFIED_SIGNATURE_HASH_KEY,
}

export type {
  BuiltinTerminalHighlightRule,
  CustomTerminalHighlightRule,
  TerminalHighlightRenderChannel,
  TerminalHighlightRule,
  TerminalHighlightSemanticToken,
} from '../lib/terminal-highlight/rules'
export {
  DEFAULT_TERMINAL_HIGHLIGHT_RULES,
  normalizeTerminalHighlightRules,
} from '../lib/terminal-highlight/rules'

export function buildSyncBody(): SyncRequestBody {
  return buildSyncBodyFromSettings(useSettingsStore.getState())
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  _dirty: false,
  _loaded: false,

  updateSetting: (key, value) => {
    set({ [key]: value, _dirty: true } as Partial<SettingsStore>)
    if (key === 'language') loadLocale(value as string)
  },

  loadSettings: async () => {
    try {
      const remote = await api.getSettings()
      const merged = normalizeRemoteSettings(remote as Record<string, unknown>)
      set({ ...merged, _loaded: true, _dirty: false })
    } catch {
      set({ _loaded: true })
    }
  },

  applySettings: async () => {
    const state = get()
    if (!state._loaded) return
    const settings: Record<string, unknown> = {}
    for (const k of Object.keys(DEFAULTS)) settings[k] = state[k as keyof SettingsState]
    try {
      await api.saveSettings(settings)
      set({ _dirty: false })
    } catch (e) {
      console.error('[Vortix] 保存设置失败', e)
    }
  },

  resetToDefaults: async () => {
    const preserved: Partial<SettingsState> = {}
    const current = get()
    for (const k of TERM_APPEARANCE_KEYS) (preserved as Record<string, unknown>)[k] = current[k]
    try {
      await api.resetSettings()
    } catch {
      // ignore
    }
    set({ ...DEFAULTS, ...preserved, _dirty: false })
  },
}))
