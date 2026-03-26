import { emit, emitTo } from '@tauri-apps/api/event'
import { useCallback, useMemo, useState } from 'react'
import {
  normalizeTerminalHighlightRules,
  useSettingsStore,
  type TerminalHighlightRule,
} from '../../../stores/useSettingsStore'
import { useThemeStore } from '../../../stores/useThemeStore'
import {
  resolveThemeHighlightPalette,
} from '../../../lib/terminal-highlight/resolver'
import {
  buildTerminalHighlightDisplayRules,
  clearCustomTerminalHighlightRules,
  removeTerminalHighlightRule,
  saveTerminalHighlightRules,
} from '../../../lib/terminal-highlight/panel'
import type { KeywordHighlightPanelState } from './types'

export function useKeywordHighlightPanelState(): KeywordHighlightPanelState {
  const rawRules = useSettingsStore((state) => state.termHighlightRules)
  const normalizedRules = useMemo(() => normalizeTerminalHighlightRules(rawRules), [rawRules])
  const enabled = useSettingsStore((state) => state.termHighlightEnhance)
  const termThemeLight = useSettingsStore((state) => state.termThemeLight)
  const termThemeDark = useSettingsStore((state) => state.termThemeDark)
  const update = useSettingsStore((state) => state.updateSetting)
  const applySettings = useSettingsStore((state) => state.applySettings)
  const loaded = useSettingsStore((state) => state._loaded)
  const runtimeMode = useThemeStore((state) => state.runtimeMode)
  const activeThemeId = runtimeMode === 'dark' ? termThemeDark : termThemeLight
  const activeThemeHighlights = useThemeStore((state) => state.getThemeById(activeThemeId)?.highlights)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formPattern, setFormPattern] = useState('')
  const [formColor, setFormColor] = useState('#F53F3F')

  const resolvedPalette = useMemo(
    () => resolveThemeHighlightPalette(activeThemeHighlights),
    [activeThemeHighlights],
  )

  const rules = useMemo(
    () => buildTerminalHighlightDisplayRules(normalizedRules, resolvedPalette),
    [normalizedRules, resolvedPalette],
  )

  const editingRule = useMemo(
    () => rules.find((rule) => rule.rule.id === editingId) ?? null,
    [editingId, rules],
  )

  const emitConfigChanged = useCallback(async (keys: string[]) => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return
    const payload = { source: 'terminal-highlight', keys }
    await emit('config-changed', payload)
    await emitTo('settings', 'config-changed', payload)
  }, [])

  const commitRules = useCallback((next: TerminalHighlightRule[]) => {
    update('termHighlightRules', next)
    if (!loaded) return
    void (async () => {
      await applySettings()
      await emitConfigChanged(['termHighlightRules'])
    })()
  }, [applySettings, emitConfigChanged, loaded, update])

  const handleEdit = useCallback((item: KeywordHighlightPanelState['rules'][number]) => {
    const { rule } = item
    setEditingId(rule.id)
    setFormName(rule.name)
    setFormPattern(rule.pattern)
    setFormColor(item.displayColor)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setFormName('')
    setFormPattern('')
    setFormColor('#F53F3F')
  }, [])

  const handleSave = useCallback(() => {
    const nextRules = saveTerminalHighlightRules(normalizedRules, {
      editingId,
      name: formName,
      pattern: formPattern,
      color: formColor,
    })
    if (!nextRules) return
    commitRules(nextRules)
    if (editingId) setEditingId(null)

    setFormName('')
    setFormPattern('')
    setFormColor('#F53F3F')
  }, [commitRules, editingId, formColor, formName, formPattern, normalizedRules])

  const handleDelete = useCallback((id: string) => {
    commitRules(removeTerminalHighlightRule(normalizedRules, id))
  }, [commitRules, normalizedRules])

  const handleClearCustom = useCallback(() => {
    commitRules(clearCustomTerminalHighlightRules(normalizedRules))
  }, [commitRules, normalizedRules])

  const toggleEnabled = useCallback(() => {
    update('termHighlightEnhance', !enabled)
    if (!loaded) return
    void (async () => {
      await applySettings()
      await emitConfigChanged(['termHighlightEnhance'])
    })()
  }, [applySettings, emitConfigChanged, enabled, loaded, update])

  return {
    rules,
    enabled,
    editingId,
    editingRule,
    formName,
    setFormName,
    formPattern,
    setFormPattern,
    formColor,
    setFormColor,
    hasCustomRules: normalizedRules.some((rule) => !rule.builtin),
    isBuiltinEditing: editingRule?.rule.builtin ?? false,
    toggleEnabled,
    handleEdit,
    handleCancelEdit,
    handleSave,
    handleDelete,
    handleClearCustom,
  }
}
