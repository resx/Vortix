import { getThemeById } from '../../components/terminal/themes/index'
import type { SuggestionSource } from '../../lib/terminal-suggestions'
import { normalizeTerminalHighlightRules } from '../../lib/terminal-highlight/rules'
import { DEFAULTS, FONT_KEYS } from './defaults'
import type { SettingsState } from './types'

export function normalizeRemoteSettings(remote: Record<string, unknown>): Partial<SettingsState> {
  const merged: Partial<SettingsState> = {}
  for (const [k, v] of Object.entries(remote)) {
    if (k in DEFAULTS) (merged as Record<string, unknown>)[k] = v
  }

  merged.termHighlightRules = normalizeTerminalHighlightRules(remote.termHighlightRules)

  const remoteSources = remote.termSuggestionSources
  if (Array.isArray(remoteSources)) {
    const allowed = new Set<SuggestionSource>(['history', 'snippet', 'command-spec'])
    const normalized = remoteSources.filter((item): item is SuggestionSource => typeof item === 'string' && allowed.has(item as SuggestionSource))
    ;(merged as Record<string, unknown>).termSuggestionSources = normalized.length > 0 ? [...new Set(normalized)] : [...DEFAULTS.termSuggestionSources]
  }

  const remoteMode = remote.termSuggestionMode
  if (typeof remoteMode === 'string') {
    const allowedModes = new Set<SettingsState['termSuggestionMode']>(['off', 'strict-prefix', 'smart', 'fuzzy'])
    if (allowedModes.has(remoteMode as SettingsState['termSuggestionMode'])) {
      ;(merged as Record<string, unknown>).termSuggestionMode = remoteMode
    }
  } else if (typeof remote.termCommandHint === 'boolean') {
    ;(merged as Record<string, unknown>).termSuggestionMode = remote.termCommandHint ? 'smart' : 'off'
  }

  for (const fk of FONT_KEYS) {
    if (typeof merged[fk] === 'string') (merged as Record<string, unknown>)[fk] = [merged[fk]]
  }

  const legacy = remote.termTheme
  if (typeof legacy === 'string' && !('termThemeLight' in remote)) {
    if (legacy === 'auto') {
      merged.termThemeLight = 'default-light'
      merged.termThemeDark = 'default-dark'
    } else {
      const preset = getThemeById(legacy)
      if (preset) {
        if (preset.mode === 'dark') {
          merged.termThemeDark = legacy
          merged.termThemeLight = DEFAULTS.termThemeLight
        } else {
          merged.termThemeLight = legacy
          merged.termThemeDark = DEFAULTS.termThemeDark
        }
      }
    }
  }

  return merged
}
