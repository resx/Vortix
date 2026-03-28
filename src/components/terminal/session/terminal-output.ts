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
const MUTABLE_TERMINAL_OUTPUT_REGEX = new RegExp(String.raw`[\r\b]`)
const ANSI_FOREGROUND_RESET = '\x1b[39m'

export interface IncrementalHighlightResult {
  renderedText: string
  nextTail: string
}

function isVortixStatusLine(text: string): boolean {
  const plain = text.replace(ANSI_ESCAPE_REGEX, '')
  return plain.trimStart().startsWith('[Vortix]')
}

export function shouldPreserveTerminalOutput(text: string): boolean {
  return MUTABLE_TERMINAL_OUTPUT_REGEX.test(text)
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

type HighlightRuntimeRule = Pick<ResolvedTerminalHighlightRule, 'ansiOpen' | 'pattern'>

interface TerminalOutputSegment {
  value: string
  isAnsi: boolean
  sourceStart: number
  sourceEnd: number
}

interface HighlightMatchCandidate {
  index: number
  text: string
  ansiOpen: string
  order: number
}

function findNextHighlightMatch(
  text: string,
  rules: HighlightRuntimeRule[],
  fromIndex: number,
): HighlightMatchCandidate | null {
  let best: HighlightMatchCandidate | null = null
  for (const [order, rule] of rules.entries()) {
    rule.pattern.lastIndex = fromIndex
    const match = rule.pattern.exec(text)
    if (!match || !match[0]) continue
    const candidate = { index: match.index, text: match[0], ansiOpen: rule.ansiOpen, order }
    if (
      !best
      || candidate.index < best.index
      || (candidate.index === best.index && candidate.text.length > best.text.length)
      || (candidate.index === best.index && candidate.text.length === best.text.length && candidate.order < best.order)
    ) {
      best = candidate
    }
  }
  return best
}

function renderIncrementalPlainText(
  source: string,
  rules: HighlightRuntimeRule[],
  outputStart: number,
): string {
  const outputEnd = source.length
  let cursor = 0
  let output = ''

  while (cursor < outputEnd) {
    const next = findNextHighlightMatch(source, rules, cursor)
    if (!next || next.index >= outputEnd) {
      if (cursor < outputEnd) {
        output += source.slice(Math.max(cursor, outputStart), outputEnd)
      }
      break
    }
    if (next.index > cursor) {
      output += source.slice(Math.max(cursor, outputStart), Math.min(next.index, outputEnd))
    }
    const matchEnd = next.index + next.text.length
    if (matchEnd > outputStart) {
      const visibleStart = Math.max(next.index, outputStart)
      const visibleEnd = Math.min(matchEnd, outputEnd)
      if (visibleStart < visibleEnd) {
        output += `${next.ansiOpen}${source.slice(visibleStart, visibleEnd)}${ANSI_FOREGROUND_RESET}`
      }
    }
    cursor = matchEnd
  }

  return output
}

function splitTerminalOutputSegments(text: string): TerminalOutputSegment[] {
  const segments: TerminalOutputSegment[] = []
  let cursor = 0
  for (const match of text.matchAll(ANSI_ESCAPE_REGEX)) {
    const index = match.index ?? 0
    const value = match[0]
    if (cursor < index) {
      segments.push({ value: text.slice(cursor, index), isAnsi: false, sourceStart: cursor, sourceEnd: index })
    }
    segments.push({
      value,
      isAnsi: true,
      sourceStart: index,
      sourceEnd: index + value.length,
    })
    cursor = index + value.length
  }
  if (cursor < text.length) {
    segments.push({ value: text.slice(cursor), isAnsi: false, sourceStart: cursor, sourceEnd: text.length })
  }
  return segments
}

function renderTerminalSegment(
  segment: TerminalOutputSegment,
  rules: HighlightRuntimeRule[],
  outputStart: number,
): string {
  if (segment.sourceEnd <= outputStart) return ''
  const visibleStart = Math.max(outputStart, segment.sourceStart) - segment.sourceStart
  if (segment.isAnsi) {
    return segment.value.slice(visibleStart)
  }
  return renderIncrementalPlainText(segment.value, rules, visibleStart)
}

function renderIncrementalTerminalOutput(
  source: string,
  rules: HighlightRuntimeRule[],
  outputStart: number,
): string {
  return splitTerminalOutputSegments(source)
    .map(segment => renderTerminalSegment(segment, rules, outputStart))
    .join('')
}

function extractTrailingLineFragment(text: string): string {
  const tailStart = Math.max(text.lastIndexOf('\n'), text.lastIndexOf('\r'))
  return tailStart >= 0 ? text.slice(tailStart + 1) : text
}

export function applyIncrementalAnsiSafeHighlight(
  text: string,
  rules: HighlightRuntimeRule[],
  previousTail: string,
): IncrementalHighlightResult {
  if (!text || rules.length === 0) {
    return { renderedText: text, nextTail: '' }
  }
  if (isVortixStatusLine(text) || shouldPreserveTerminalOutput(text)) {
    return { renderedText: text, nextTail: '' }
  }

  const source = `${previousTail}${text}`
  const renderedText = renderIncrementalTerminalOutput(source, rules, previousTail.length)
  return {
    renderedText,
    nextTail: extractTrailingLineFragment(source),
  }
}
