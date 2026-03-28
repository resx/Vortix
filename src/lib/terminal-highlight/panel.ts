import type { ThemeHighlights } from '../../types/theme'
import type {
  TerminalHighlightRule,
  TerminalHighlightSemanticToken,
  TerminalHighlightRenderChannel,
} from '../../stores/useSettingsStore'
import { getTerminalHighlightRenderChannel } from './rules'
import { resolveTerminalHighlightRuleColor } from './resolver'

interface SaveRuleDraft {
  editingId: string | null
  name: string
  pattern: string
  color: string
}

export interface TerminalHighlightDisplayRule {
  rule: TerminalHighlightRule
  displayColor: string
  colorLocked: boolean
  semanticToken?: TerminalHighlightSemanticToken
  renderChannel: TerminalHighlightRenderChannel
}

export function buildTerminalHighlightDisplayRules(
  rules: TerminalHighlightRule[],
  palette: ThemeHighlights,
): TerminalHighlightDisplayRule[] {
  return rules.map((rule) => ({
    rule,
    displayColor: resolveTerminalHighlightRuleColor(rule, palette),
    colorLocked: rule.builtin,
    semanticToken: rule.builtin ? rule.semanticToken : undefined,
    renderChannel: getTerminalHighlightRenderChannel(rule),
  }))
}

export function saveTerminalHighlightRules(
  rules: TerminalHighlightRule[],
  draft: SaveRuleDraft,
): TerminalHighlightRule[] | null {
  const trimmedName = draft.name.trim()
  const trimmedPattern = draft.pattern.trim() || (trimmedName ? `\\b${trimmedName}\\b` : '')

  if (draft.editingId) {
    const target = rules.find((rule) => rule.id === draft.editingId)
    if (!target || !trimmedPattern) return null
    return rules.map((rule) => {
      if (rule.id !== draft.editingId) return rule
      if (rule.builtin) {
        return { ...rule, pattern: trimmedPattern }
      }
      return {
        ...rule,
        name: trimmedName || rule.name,
        pattern: trimmedPattern,
        color: draft.color,
      }
    })
  }

  if (!trimmedName || !trimmedPattern) return null
  return [
    ...rules,
    {
      id: `custom-${Date.now()}`,
      name: trimmedName,
      pattern: trimmedPattern,
      flags: 'g',
      color: draft.color,
      builtin: false,
    },
  ]
}

export function removeTerminalHighlightRule(
  rules: TerminalHighlightRule[],
  id: string,
): TerminalHighlightRule[] {
  return rules.filter((rule) => rule.id !== id)
}

export function clearCustomTerminalHighlightRules(
  rules: TerminalHighlightRule[],
): TerminalHighlightRule[] {
  return rules.filter((rule) => rule.builtin)
}
