import { DEFAULT_HIGHLIGHTS } from '../theme-bridge'
import type { ThemeHighlights } from '../../types/theme'
import {
  isBuiltinTerminalHighlightRule,
  normalizeTerminalHighlightRules,
  normalizeHexColor,
  normalizeRegexFlags,
  shouldRenderTerminalHighlightInAnsi,
  type TerminalHighlightRule,
} from './rules'

export interface ResolvedTerminalHighlightRule {
  rule: TerminalHighlightRule
  color: string
  pattern: RegExp
  ansiOpen: string
}

function hexToRgb(color: string): [number, number, number] | null {
  const normalized = normalizeHexColor(color)
  if (!normalized) return null
  const value = Number.parseInt(normalized.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function buildAnsiOpen(color: string): string | null {
  const rgb = hexToRgb(color)
  if (!rgb) return null
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m`
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
    if (!shouldRenderTerminalHighlightInAnsi(rule)) continue
    if (!rule.pattern.trim()) continue
    try {
      const color = resolveTerminalHighlightRuleColor(rule, palette)
      const ansiOpen = buildAnsiOpen(color)
      if (!ansiOpen) continue
      resolved.push({
        rule,
        color,
        pattern: new RegExp(rule.pattern, normalizeRegexFlags(rule.flags)),
        ansiOpen,
      })
    } catch {
      // Ignore invalid regex rules and keep rendering the rest.
    }
  }

  return resolved
}
