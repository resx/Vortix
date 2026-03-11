/* ── 后端 ANSI 高亮拦截器 ── */
/* 在 SSH 数据流中注入 ANSI 颜色码，替代前端 decoration 方案 */

import { EventEmitter } from 'events'

// ── 类型定义 ──

export interface HighlightConfig {
  enabled: boolean
  colors: Record<string, string> // category → hex color
}

interface HighlightRule {
  category: string
  priority: number
  pattern: RegExp
}

interface AnsiGraphicState {
  fgColor: string | null   // '38;2;R;G;B' | '38;5;N' | '31'-'37' | null
  bgColor: string | null
  bold: boolean
  dim: boolean
  italic: boolean
  underline: boolean
  blink: boolean
  inverse: boolean
  strikethrough: boolean
}

// ── 默认规则集 ──

const DEFAULT_RULES: HighlightRule[] = [
  { category: 'error',     priority: 90, pattern: /\b(error|ERROR|fail|FAIL|failed|FAILED|fatal|FATAL|panic|PANIC|CRITICAL|critical|exception|EXCEPTION)\b/g },
  { category: 'warning',   priority: 80, pattern: /\b(warning|WARNING|warn|WARN|deprecated|DEPRECATED|caution|CAUTION)\b/g },
  { category: 'ok',        priority: 80, pattern: /\b(ok|OK|success|SUCCESS|succeeded|SUCCEEDED|passed|PASSED|done|DONE|ready|READY|active|ACTIVE|running|RUNNING)\b/g },
  { category: 'info',      priority: 70, pattern: /\b(info|INFO|notice|NOTICE|note|NOTE)\b/g },
  { category: 'debug',     priority: 60, pattern: /\b(debug|DEBUG|trace|TRACE|verbose|VERBOSE)\b/g },
  { category: 'ipMac',     priority: 85, pattern: /\b(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?(?::\d+)?\b|(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g },
  { category: 'url',       priority: 85, pattern: /https?:\/\/[^\s'")\]>]+/g },
  { category: 'timestamp', priority: 55, pattern: /\b\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g },
  { category: 'path',      priority: 50, pattern: /(?:\/[\w.-]+){2,}(?:\.\w+)?/g },
  { category: 'env',       priority: 50, pattern: /\$\{?\w+\}?/g },
]

const DEFAULT_COLORS: Record<string, string> = {
  error: '#F53F3F', warning: '#E6A23C', ok: '#00B42A', info: '#4080FF',
  debug: '#86909C', ipMac: '#9A7ECC', path: '#D2B48C', url: '#00B4D8',
  timestamp: '#8B8682', env: '#61AFEF',
}

// ── CSI / OSC 正则 ──

const ESC = '\\u001b'
const BEL = '\\u0007'
const CSI_RE = new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, 'g')
const OSC_RE = new RegExp(`${ESC}\\].*?(?:${ESC}\\\\|${BEL})`, 'g')
const INCOMPLETE_ESC_RE = new RegExp(`${ESC}(?:\\[?[0-9;]*)?$`)
const SGR_RE = new RegExp(`^${ESC}\\[([0-9;]*)m$`)

// ── 工具函数 ──

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function createFgAnsi(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  return `\x1b[38;2;${r};${g};${b}m`
}

function createAnsiState(): AnsiGraphicState {
  return { fgColor: null, bgColor: null, bold: false, dim: false, italic: false, underline: false, blink: false, inverse: false, strikethrough: false }
}

/** 解析 SGR 序列（\x1b[...m）更新图形状态 */
function parseSgr(params: string, state: AnsiGraphicState): void {
  const codes = params === '' ? [0] : params.split(';').map(Number)
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i]
    if (c === 0) { Object.assign(state, createAnsiState()); continue }
    if (c === 1) { state.bold = true; continue }
    if (c === 2) { state.dim = true; continue }
    if (c === 3) { state.italic = true; continue }
    if (c === 4) { state.underline = true; continue }
    if (c === 5) { state.blink = true; continue }
    if (c === 7) { state.inverse = true; continue }
    if (c === 9) { state.strikethrough = true; continue }
    if (c === 22) { state.bold = false; state.dim = false; continue }
    if (c === 23) { state.italic = false; continue }
    if (c === 24) { state.underline = false; continue }
    if (c === 25) { state.blink = false; continue }
    if (c === 27) { state.inverse = false; continue }
    if (c === 29) { state.strikethrough = false; continue }
    // 前景色
    if (c >= 30 && c <= 37) { state.fgColor = String(c); continue }
    if (c === 39) { state.fgColor = null; continue }
    if (c === 38) {
      if (codes[i + 1] === 5) { state.fgColor = `38;5;${codes[i + 2]}`; i += 2; continue }
      if (codes[i + 1] === 2) { state.fgColor = `38;2;${codes[i + 2]};${codes[i + 3]};${codes[i + 4]}`; i += 4; continue }
    }
    // 背景色
    if (c >= 40 && c <= 47) { state.bgColor = String(c); continue }
    if (c === 49) { state.bgColor = null; continue }
    if (c === 48) {
      if (codes[i + 1] === 5) { state.bgColor = `48;5;${codes[i + 2]}`; i += 2; continue }
      if (codes[i + 1] === 2) { state.bgColor = `48;2;${codes[i + 2]};${codes[i + 3]};${codes[i + 4]}`; i += 4; continue }
    }
  }
}

/** 根据当前状态构建恢复序列（不用 reset，精确恢复） */
function buildRestoreSequence(state: AnsiGraphicState): string {
  const parts: string[] = []
  // 先 reset 再重建，比逐项恢复更可靠
  parts.push('0')
  if (state.bold) parts.push('1')
  if (state.dim) parts.push('2')
  if (state.italic) parts.push('3')
  if (state.underline) parts.push('4')
  if (state.blink) parts.push('5')
  if (state.inverse) parts.push('7')
  if (state.strikethrough) parts.push('9')
  if (state.fgColor) parts.push(state.fgColor)
  if (state.bgColor) parts.push(state.bgColor)
  return `\x1b[${parts.join(';')}m`
}

// ── 核心类 ──

export class HighlightInterceptor extends EventEmitter {
  private config: HighlightConfig
  private rules: HighlightRule[]
  private state: AnsiGraphicState = createAnsiState()
  private lineBuffer = ''
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config?: Partial<HighlightConfig>) {
    super()
    this.config = {
      enabled: config?.enabled ?? true,
      colors: { ...DEFAULT_COLORS, ...config?.colors },
    }
    this.rules = [...DEFAULT_RULES].sort((a, b) => b.priority - a.priority)
  }

  updateConfig(config: Partial<HighlightConfig>): void {
    if (config.enabled !== undefined) this.config.enabled = config.enabled
    if (config.colors) this.config.colors = { ...this.config.colors, ...config.colors }
  }

  getCategories(): string[] {
    return this.rules.map(r => r.category)
  }

  /** 处理一个 chunk，输出高亮后的数据 */
  processChunk(chunk: string): void {
    if (!this.config.enabled) {
      this.emit('data', chunk)
      return
    }

    // 拼接缓冲
    const input = this.lineBuffer + chunk
    this.lineBuffer = ''
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null }

    // 检查末尾是否有不完整的 ANSI 序列
    const incompleteMatch = input.match(INCOMPLETE_ESC_RE)
    let processable: string
    if (incompleteMatch) {
      this.lineBuffer = incompleteMatch[0]
      processable = input.slice(0, input.length - incompleteMatch[0].length)
    } else {
      processable = input
    }

    // 按 \n 分割，完整行立即处理
    const lines = processable.split('\n')
    const results: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const isLast = i === lines.length - 1
      const line = lines[i]

      if (isLast && line !== '') {
        // 最后一段没有 \n 结尾，缓冲起来
        this.lineBuffer = line + this.lineBuffer
      } else {
        results.push(this.highlightLine(line))
        if (!isLast) results.push('\n')
      }
    }

    if (results.length > 0) {
      this.emit('data', results.join(''))
    }

    // 缓冲区有内容时设置超时刷新
    if (this.lineBuffer) {
      this.flushTimer = setTimeout(() => this.flush(), 16)
    }
  }

  /** 强制刷新缓冲区 */
  flush(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null }
    if (this.lineBuffer) {
      const buf = this.lineBuffer
      this.lineBuffer = ''
      if (this.config.enabled) {
        this.emit('data', this.highlightLine(buf))
      } else {
        this.emit('data', buf)
      }
    }
  }

  /** 高亮单行：解析 ANSI 段 + 纯文本段，在纯文本中注入颜色 */
  private highlightLine(line: string): string {
    if (!line) return line

    // 将行拆分为 [ansi序列, 纯文本, ansi序列, 纯文本, ...] 的 segments
    type Segment = { type: 'ansi' | 'text'; content: string }
    const segments: Segment[] = []
    let lastIndex = 0

    // 合并 CSI 和 OSC 匹配
    const allEscapes: { start: number; end: number; content: string }[] = []
    CSI_RE.lastIndex = 0
    OSC_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = CSI_RE.exec(line)) !== null) {
      allEscapes.push({ start: m.index, end: m.index + m[0].length, content: m[0] })
    }
    while ((m = OSC_RE.exec(line)) !== null) {
      allEscapes.push({ start: m.index, end: m.index + m[0].length, content: m[0] })
    }
    allEscapes.sort((a, b) => a.start - b.start)

    for (const esc of allEscapes) {
      if (esc.start > lastIndex) {
        segments.push({ type: 'text', content: line.slice(lastIndex, esc.start) })
      }
      segments.push({ type: 'ansi', content: esc.content })
      lastIndex = esc.end
    }
    if (lastIndex < line.length) {
      segments.push({ type: 'text', content: line.slice(lastIndex) })
    }

    // 处理每个 segment
    const output: string[] = []
    for (const seg of segments) {
      if (seg.type === 'ansi') {
        // 更新 ANSI 图形状态
        const sgrMatch = seg.content.match(SGR_RE)
        if (sgrMatch) {
          parseSgr(sgrMatch[1], this.state)
        }
        output.push(seg.content)
      } else {
        // 纯文本段：匹配关键词并注入颜色
        output.push(this.highlightText(seg.content))
      }
    }

    return output.join('')
  }

  /** 在纯文本中匹配关键词，注入 ANSI 前景色，匹配结束后恢复状态 */
  private highlightText(text: string): string {
    // 收集所有匹配，按位置排序，处理重叠（高优先级覆盖）
    type Match = { start: number; end: number; category: string }
    const matches: Match[] = []

    for (const rule of this.rules) {
      const color = this.config.colors[rule.category]
      if (!color) continue
      rule.pattern.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = rule.pattern.exec(text)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, category: rule.category })
      }
    }

    if (matches.length === 0) return text

    // 按 start 排序，重叠时保留高优先级（rules 已按 priority 降序）
    matches.sort((a, b) => a.start - b.start || b.end - a.end)
    const filtered: Match[] = []
    let maxEnd = 0
    for (const mt of matches) {
      if (mt.start >= maxEnd) {
        filtered.push(mt)
        maxEnd = mt.end
      }
    }

    const result: string[] = []
    let pos = 0
    const restoreSeq = buildRestoreSequence(this.state)

    for (const mt of filtered) {
      if (mt.start > pos) {
        result.push(text.slice(pos, mt.start))
      }
      const colorSeq = createFgAnsi(this.config.colors[mt.category])
      result.push(colorSeq + text.slice(mt.start, mt.end) + restoreSeq)
      pos = mt.end
    }
    if (pos < text.length) {
      result.push(text.slice(pos))
    }

    return result.join('')
  }

  destroy(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null }
    this.lineBuffer = ''
    this.removeAllListeners()
  }
}
