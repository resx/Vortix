import { useEffect, useRef } from 'react'
import type { Terminal, IDecoration } from '@xterm/xterm'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'

type HighlightKey = 'error' | 'warning' | 'ok' | 'info' | 'debug' | 'ipMac' | 'path' | 'url' | 'timestamp' | 'env'

const FALLBACK_HIGHLIGHTS: Record<HighlightKey, string> = {
  error: '#F53F3F',
  warning: '#E6A23C',
  ok: '#00B42A',
  info: '#4080FF',
  debug: '#86909C',
  ipMac: '#9A7ECC',
  path: '#D2B48C',
  url: '#00B4D8',
  timestamp: '#8B8682',
  env: '#61AFEF',
}

const KEYWORD_RULES: { key: HighlightKey; pattern: RegExp }[] = [
  { key: 'error',   pattern: /\b(error|ERROR|fail|FAIL|failed|FAILED|fatal|FATAL|panic|PANIC)\b/g },
  { key: 'warning', pattern: /\b(warning|WARNING|warn|WARN|deprecated|DEPRECATED)\b/g },
  { key: 'ok',      pattern: /\b(ok|OK|success|SUCCESS|succeeded|SUCCEEDED|passed|PASSED|done|DONE)\b/g },
  { key: 'info',    pattern: /\b(info|INFO|notice|NOTICE)\b/g },
  { key: 'debug',   pattern: /\b(debug|DEBUG|trace|TRACE)\b/g },
  { key: 'ipMac',   pattern: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b|(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g },
  { key: 'path',    pattern: /(?:\/[\w.-]+){2,}(?:\.\w+)?/g },
  { key: 'url',     pattern: /https?:\/\/[^\s'")\]>]+/g },
  { key: 'timestamp', pattern: /\b\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g },
  { key: 'env',     pattern: /\$\{?\w+\}?/g },
]

interface UseKeywordHighlightOptions {
  termRef: React.RefObject<Terminal | null>
  profileId?: string | null
}

export function useKeywordHighlight({ termRef, profileId }: UseKeywordHighlightOptions) {
  // 按行存储装饰，方便重扫时清理单行
  const lineDecorationsRef = useRef<Map<number, IDecoration[]>>(new Map())
  const lastScannedLineRef = useRef(-1)

  useEffect(() => {
    const term = termRef.current
    if (!term) return

    type Highlights = Record<HighlightKey, string>

    const getHighlightConfig = (): Highlights | null => {
      const ps = useTerminalProfileStore.getState()
      const s = useSettingsStore.getState()
      const profile = ps.getProfileById(profileId ?? s.activeProfileId)
        ?? ps.getDefaultProfile()
      return { ...FALLBACK_HIGHLIGHTS, ...profile.keywordHighlights }
    }

    // 清理所有装饰
    const clearAll = () => {
      for (const decs of lineDecorationsRef.current.values()) {
        for (const d of decs) d.dispose()
      }
      lineDecorationsRef.current.clear()
    }

    // 清理单行装饰
    const clearLine = (line: number) => {
      const decs = lineDecorationsRef.current.get(line)
      if (decs) {
        for (const d of decs) d.dispose()
        lineDecorationsRef.current.delete(line)
      }
    }

    // 扫描单行并创建装饰（使用 term.registerMarker，非 buffer）
    const scanLine = (lineIndex: number, highlights: Highlights) => {
      const buffer = term.buffer.active
      const line = buffer.getLine(lineIndex)
      if (!line) return
      const text = line.translateToString()
      if (!text.trim()) return

      // 后端高亮开启时，前端 decoration 只保留兜底职责，避免重复着色。
      const settings = useSettingsStore.getState()
      if (settings.termHighlightEnhance) return

      const decs: IDecoration[] = []
      const cursorAbsY = buffer.baseY + buffer.cursorY

      for (const rule of KEYWORD_RULES) {
        const color = highlights[rule.key]
        if (!color) continue
        rule.pattern.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = rule.pattern.exec(text)) !== null) {
          // term.registerMarker 的参数是相对于当前光标行的偏移
          const marker = term.registerMarker(lineIndex - cursorAbsY)
          if (!marker) continue
          const decoration = term.registerDecoration({
            marker,
            x: match.index,
            width: match[0].length,
            foregroundColor: color,
            layer: 'top',
          })
          if (decoration) decs.push(decoration)
        }
      }
      if (decs.length > 0) {
        lineDecorationsRef.current.set(lineIndex, decs)
      }
    }

    // 增量扫描：从 lastScannedLine 开始（重扫光标行，避免漏掉后续写入的内容）
    const scanNewLines = () => {
      const highlights = getHighlightConfig()
      if (!highlights) return
      const buffer = term.buffer.active
      const currentLine = buffer.baseY + buffer.cursorY
      const startLine = Math.max(lastScannedLineRef.current, 0)
      for (let y = startLine; y <= currentLine; y++) {
        clearLine(y)
        scanLine(y, highlights)
      }
      lastScannedLineRef.current = currentLine
    }

    // 全量重扫（配置变更时）
    const fullRescan = () => {
      clearAll()
      lastScannedLineRef.current = -1
      const highlights = getHighlightConfig()
      if (!highlights) return
      const buffer = term.buffer.active
      const end = buffer.baseY + buffer.cursorY
      for (let y = 0; y <= end; y++) {
        scanLine(y, highlights)
      }
      lastScannedLineRef.current = end
    }

    const writeDisposable = term.onWriteParsed(scanNewLines)

    const unsub1 = useTerminalProfileStore.subscribe(fullRescan)
    const unsub2 = useSettingsStore.subscribe((s, prev) => {
      if (s.termHighlightEnhance !== prev.termHighlightEnhance ||
          s.keywordHighlights !== prev.keywordHighlights) {
        fullRescan()
      }
    })

    return () => {
      writeDisposable.dispose()
      unsub1()
      unsub2()
      clearAll()
    }
  }, [termRef, profileId])
}
