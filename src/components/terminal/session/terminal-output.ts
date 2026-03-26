import type { ResolvedTerminalHighlightRule } from '../../../lib/terminal-highlight/resolver'

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
    // Ignore bell errors in restricted browser environments.
  }
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
  const value = Number.parseInt(raw, 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

function colorWrap(text: string, color: string): string {
  const rgb = hexToRgb(color)
  if (!rgb) return text
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\x1b[39m`
}

function applyHighlightToPlainText(
  text: string,
  rules: Pick<ResolvedTerminalHighlightRule, 'color' | 'pattern'>[],
): string {
  let output = text
  for (const rule of rules) {
    output = output.replace(rule.pattern, (match) => colorWrap(match, rule.color))
  }
  return output
}

export function applyAnsiSafeHighlight(
  text: string,
  rules: Pick<ResolvedTerminalHighlightRule, 'color' | 'pattern'>[],
): string {
  if (isVortixStatusLine(text) || shouldPreserveTerminalOutput(text)) return text

  let result = ''
  let last = 0
  ANSI_ESCAPE_REGEX.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = ANSI_ESCAPE_REGEX.exec(text)) !== null) {
    const index = match.index
    if (index > last) {
      result += applyHighlightToPlainText(text.slice(last, index), rules)
    }
    result += match[0]
    last = index + match[0].length
  }

  if (last < text.length) {
    result += applyHighlightToPlainText(text.slice(last), rules)
  }

  return result
}
