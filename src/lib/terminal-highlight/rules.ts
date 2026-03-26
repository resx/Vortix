import type { ThemeHighlights } from '../../types/theme'

export type TerminalHighlightSemanticToken = keyof ThemeHighlights

interface TerminalHighlightRuleBase {
  id: string
  name: string
  pattern: string
  flags: string
}

export interface BuiltinTerminalHighlightRule extends TerminalHighlightRuleBase {
  builtin: true
  semanticToken: TerminalHighlightSemanticToken
}

export interface CustomTerminalHighlightRule extends TerminalHighlightRuleBase {
  builtin: false
  color: string
}

export type TerminalHighlightRule = BuiltinTerminalHighlightRule | CustomTerminalHighlightRule

export const DEFAULT_TERMINAL_HIGHLIGHT_RULES: TerminalHighlightRule[] = [
  { id: 'builtin-error', name: 'Error', pattern: '\\b(error|ERROR|fail|FAIL|failed|FAILED|fatal|FATAL|panic|PANIC)\\b', flags: 'g', builtin: true, semanticToken: 'error' },
  { id: 'builtin-warning', name: 'Warning', pattern: '\\b(warning|WARNING|warn|WARN|deprecated|DEPRECATED)\\b', flags: 'g', builtin: true, semanticToken: 'warning' },
  { id: 'builtin-ok', name: 'OK', pattern: '\\b(ok|OK|success|SUCCESS|succeeded|SUCCEEDED|passed|PASSED|done|DONE)\\b', flags: 'g', builtin: true, semanticToken: 'ok' },
  { id: 'builtin-info', name: 'Info', pattern: '\\b(info|INFO|notice|NOTICE)\\b', flags: 'g', builtin: true, semanticToken: 'info' },
  { id: 'builtin-debug', name: 'Debug', pattern: '\\b(debug|DEBUG|trace|TRACE)\\b', flags: 'g', builtin: true, semanticToken: 'debug' },
  { id: 'builtin-ipMac', name: 'IP & MAC', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}(?::\\d+)?\\b|(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\\b', flags: 'g', builtin: true, semanticToken: 'ipMac' },
  { id: 'builtin-path', name: 'Path', pattern: '(?:\\/[\\w.-]+){2,}(?:\\.\\w+)?', flags: 'g', builtin: true, semanticToken: 'path' },
  { id: 'builtin-url', name: 'URL', pattern: 'https?:\\/\\/[^\\s\'")\\]>]+', flags: 'g', builtin: true, semanticToken: 'url' },
  { id: 'builtin-timestamp', name: 'Timestamp', pattern: '\\b\\d{4}[-/]\\d{2}[-/]\\d{2}[T ]\\d{2}:\\d{2}(?::\\d{2})?(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?\\b', flags: 'g', builtin: true, semanticToken: 'timestamp' },
  { id: 'builtin-env', name: 'Env', pattern: '\\$\\{?\\w+\\}?', flags: 'g', builtin: true, semanticToken: 'env' },
]

export function isBuiltinTerminalHighlightRule(rule: TerminalHighlightRule): rule is BuiltinTerminalHighlightRule {
  return rule.builtin
}

export function normalizeRegexFlags(flags?: string): string {
  const valid = new Set(['g', 'i', 'm', 's', 'u', 'y'])
  const uniq: string[] = []
  for (const ch of (flags ?? '').toLowerCase()) {
    if (valid.has(ch) && !uniq.includes(ch)) uniq.push(ch)
  }
  if (!uniq.includes('g')) uniq.unshift('g')
  return uniq.join('')
}

export function normalizeHexColor(color?: string): string | null {
  const value = (color ?? '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toUpperCase()
  return null
}

export function normalizeTerminalHighlightRules(input: unknown): TerminalHighlightRule[] {
  const defaults = DEFAULT_TERMINAL_HIGHLIGHT_RULES.map((rule) => ({ ...rule }))
  if (!Array.isArray(input)) return defaults

  const builtinById = new Map(defaults.filter(isBuiltinTerminalHighlightRule).map((rule) => [rule.id, rule]))
  const customRules: CustomTerminalHighlightRule[] = []

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const obj = raw as Record<string, unknown>
    const id = typeof obj.id === 'string' ? obj.id : ''
    if (!id) continue

    const builtinBase = builtinById.get(id)
    const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name : (builtinBase?.name ?? id)
    const pattern = typeof obj.pattern === 'string' && obj.pattern.trim() ? obj.pattern : (builtinBase?.pattern ?? '')
    const flags = normalizeRegexFlags(typeof obj.flags === 'string' ? obj.flags : (builtinBase?.flags ?? 'g'))

    if (builtinBase) {
      builtinById.set(id, {
        ...builtinBase,
        name: builtinBase.name,
        pattern,
        flags,
      })
      continue
    }

    const color = normalizeHexColor(typeof obj.color === 'string' ? obj.color : undefined) ?? '#86909C'
    customRules.push({
      id,
      name,
      pattern,
      flags,
      color,
      builtin: false,
    })
  }

  return [...defaults.map((rule) => builtinById.get(rule.id) ?? rule), ...customRules]
}
