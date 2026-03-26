import type { TerminalHighlightRule } from '../../../stores/useSettingsStore'

let bellAudioCtx: AudioContext | null = null

export function playBellSound() {
  try {
    if (!bellAudioCtx) bellAudioCtx = new AudioContext()
    const ctx = bellAudioCtx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    gain.gain.value = 0.08
    osc.start(ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.stop(ctx.currentTime + 0.12)
  } catch {
    // 静默处理浏览器或权限导致的音频初始化失败
  }
}

function normalizeRegexFlags(flags?: string): string {
  const valid = new Set(['g', 'i', 'm', 's', 'u', 'y'])
  const uniq: string[] = []
  for (const ch of (flags ?? '').toLowerCase()) {
    if (valid.has(ch) && !uniq.includes(ch)) uniq.push(ch)
  }
  if (!uniq.includes('g')) uniq.unshift('g')
  return uniq.join('')
}

export function compileHighlightRules(rules: TerminalHighlightRule[]): { color: string; pattern: RegExp }[] {
  const out: { color: string; pattern: RegExp }[] = []
  for (const rule of rules) {
    if (!rule.pattern?.trim()) continue
    try {
      const flags = normalizeRegexFlags(rule.flags)
      out.push({ color: rule.color, pattern: new RegExp(rule.pattern, flags) })
    } catch {
      // 静默忽略非法正则，避免影响整个终端输出
    }
  }
  return out
}

const ANSI_ESCAPE_REGEX = new RegExp(String.raw`\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)`, 'g')
const PROTECTED_TERMINAL_OUTPUT_REGEX = new RegExp(String.raw`[\r\b\x1b]`)

function isVortixStatusLine(text: string): boolean {
  const plain = text.replace(ANSI_ESCAPE_REGEX, '')
  return plain.trimStart().startsWith('[Vortix]')
}

export function shouldPreserveTerminalOutput(text: string): boolean {
  return PROTECTED_TERMINAL_OUTPUT_REGEX.test(text)
}

function startsWithExplicitLineBreak(text: string): boolean {
  return text.startsWith('\n') || text.startsWith('\r\n')
}

export function normalizeProtectedOutputAfterCommandStart(text: string): string {
  if (!text || startsWithExplicitLineBreak(text)) return text
  return `\r\n${text}`
}

export function endsWithExplicitLineBreak(text: string): boolean {
  return text.endsWith('\n') || text.endsWith('\r')
}

export function normalizeOutputBeforePrompt(text: string): string {
  if (!text || startsWithExplicitLineBreak(text)) return text
  return `\r\n${text}`
}

export function ensureCursorVisibleBeforePrompt(text: string): string {
  if (!text) return '\x1b[?25h'
  if (text.startsWith('\x1b[?25h')) return text
  return `\x1b[?25h${text}`
}

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  const n = Number.parseInt(raw, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function colorWrap(text: string, color: string): string {
  const rgb = hexToRgb(color)
  if (!rgb) return text
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\x1b[39m`
}

function applyHighlightToPlainText(
  text: string,
  rules: { color: string; pattern: RegExp }[],
): string {
  let output = text
  for (const rule of rules) {
    output = output.replace(rule.pattern, (m) => colorWrap(m, rule.color))
  }
  return output
}

export function applyAnsiSafeHighlight(
  text: string,
  rules: { color: string; pattern: RegExp }[],
): string {
  if (isVortixStatusLine(text) || shouldPreserveTerminalOutput(text)) return text
  let result = ''
  let last = 0
  ANSI_ESCAPE_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ANSI_ESCAPE_REGEX.exec(text)) !== null) {
    const idx = match.index
    if (idx > last) {
      result += applyHighlightToPlainText(text.slice(last, idx), rules)
    }
    result += match[0]
    last = idx + match[0].length
  }
  if (last < text.length) {
    result += applyHighlightToPlainText(text.slice(last), rules)
  }
  return result
}
