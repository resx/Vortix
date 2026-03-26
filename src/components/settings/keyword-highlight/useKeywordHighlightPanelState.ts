import { emit, emitTo } from '@tauri-apps/api/event'
import { useCallback, useMemo, useState } from 'react'
import {
  normalizeTerminalHighlightRules,
  useSettingsStore,
  type TerminalHighlightRule,
} from '../../../stores/useSettingsStore'
import type { KeywordHighlightPanelState } from './types'

export function useKeywordHighlightPanelState(): KeywordHighlightPanelState {
  const rawRules = useSettingsStore((state) => state.termHighlightRules)
  const rules = useMemo(() => normalizeTerminalHighlightRules(rawRules), [rawRules])
  const enabled = useSettingsStore((state) => state.termHighlightEnhance)
  const update = useSettingsStore((state) => state.updateSetting)
  const applySettings = useSettingsStore((state) => state.applySettings)
  const loaded = useSettingsStore((state) => state._loaded)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formPattern, setFormPattern] = useState('')
  const [formColor, setFormColor] = useState('#F53F3F')

  const emitConfigChanged = useCallback(async (keys: string[]) => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return
    const payload = { source: 'highlight-panel', keys }
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

  const handleEdit = useCallback((rule: TerminalHighlightRule) => {
    setEditingId(rule.id)
    setFormName(rule.name)
    setFormPattern(rule.pattern)
    setFormColor(rule.color)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setFormName('')
    setFormPattern('')
  }, [])

  const handleSave = useCallback(() => {
    const name = formName.trim()
    if (!name) return
    const pattern = formPattern.trim() || `\\b${name}\\b`

    if (editingId) {
      commitRules(rules.map((rule) => (
        rule.id === editingId ? { ...rule, name, pattern, color: formColor } : rule
      )))
      setEditingId(null)
    } else {
      const newRule: TerminalHighlightRule = {
        id: `custom-${Date.now()}`,
        name,
        pattern,
        flags: 'g',
        color: formColor,
        builtin: false,
      }
      commitRules([...rules, newRule])
    }

    setFormName('')
    setFormPattern('')
  }, [commitRules, editingId, formColor, formName, formPattern, rules])

  const handleDelete = useCallback((id: string) => {
    commitRules(rules.filter((rule) => rule.id !== id))
  }, [commitRules, rules])

  const handleClearCustom = useCallback(() => {
    commitRules(rules.filter((rule) => rule.builtin))
  }, [commitRules, rules])

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
    formName,
    setFormName,
    formPattern,
    setFormPattern,
    formColor,
    setFormColor,
    hasCustomRules: rules.some((rule) => !rule.builtin),
    toggleEnabled,
    handleEdit,
    handleCancelEdit,
    handleSave,
    handleDelete,
    handleClearCustom,
  }
}
