import type { ThemeHighlights } from '../../types/theme'
import type { TerminalHighlightRule } from './rules'
import {
  compileResolvedTerminalHighlightRules,
  resolveThemeHighlightPalette,
  type ResolvedTerminalHighlightRule,
} from './resolver'

export interface TerminalHighlightRuntimeCache {
  key: string
  rules: ResolvedTerminalHighlightRule[]
}

export function createTerminalHighlightRuntimeCache(): TerminalHighlightRuntimeCache {
  return { key: '', rules: [] }
}

export function getCachedResolvedTerminalHighlightRules(
  cache: TerminalHighlightRuntimeCache,
  rulesInput: TerminalHighlightRule[] | undefined,
  paletteInput?: Partial<ThemeHighlights> | null,
): ResolvedTerminalHighlightRule[] {
  const palette = resolveThemeHighlightPalette(paletteInput)
  const key = JSON.stringify({ palette, rules: rulesInput ?? [] })
  if (cache.key === key) return cache.rules
  const rules = compileResolvedTerminalHighlightRules(rulesInput, palette)
  cache.key = key
  cache.rules = rules
  return rules
}
