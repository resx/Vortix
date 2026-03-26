import { DEFAULT_HIGHLIGHTS } from '../theme-bridge'
import type { ThemeHighlights } from '../../types/theme'
import {
  isBuiltinTerminalHighlightRule,
  normalizeTerminalHighlightRules,
  normalizeHexColor,
  normalizeRegexFlags,
  type TerminalHighlightRule,
} from './rules'

export interface ResolvedTerminalHighlightRule {
  rule: TerminalHighlightRule
  color: string
  pattern: RegExp
}

export function resolveThemeHighlightPalette(input?: Partial<ThemeHighlights> | null): ThemeHighlights {
  return {
    ...DEFAULT_HIGHLIGHTS,
    ...(input ?? {}),
  }
}

export function resolveTerminalHighlightRuleColor(
  rule: TerminalHighlightRule,
  palette: ThemeHighlights,
): string {
  if (isBuiltinTerminalHighlightRule(rule)) {
    return normalizeHexColor(palette[rule.semanticToken]) ?? DEFAULT_HIGHLIGHTS[rule.semanticToken]
  }
  return normalizeHexColor(rule.color) ?? '#86909C'
}

export function compileResolvedTerminalHighlightRules(
  input: unknown,
  paletteInput?: Partial<ThemeHighlights> | null,
): ResolvedTerminalHighlightRule[] {
  const palette = resolveThemeHighlightPalette(paletteInput)
  const rules = normalizeTerminalHighlightRules(input)
  const resolved: ResolvedTerminalHighlightRule[] = []

  for (const rule of rules) {
    if (!rule.pattern.trim()) continue
    try {
      resolved.push({
        rule,
        color: resolveTerminalHighlightRuleColor(rule, palette),
        pattern: new RegExp(rule.pattern, normalizeRegexFlags(rule.flags)),
      })
    } catch {
      // Ignore invalid regex rules and keep rendering the rest.
    }
  }

  return resolved
}
