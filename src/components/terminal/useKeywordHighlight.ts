import { useEffect, useRef } from 'react'
import type { Terminal, IDecoration } from '@xterm/xterm'
import { DEFAULT_TERMINAL_HIGHLIGHT_RULES, normalizeTerminalHighlightRules, useSettingsStore } from '../../stores/useSettingsStore'
import type { TerminalHighlightRule } from '../../stores/useSettingsStore'

function normalizeRegexFlags(flags?: string): string {
  const valid = new Set(['g', 'i', 'm', 's', 'u', 'y'])
  const uniq: string[] = []
  for (const ch of (flags ?? '').toLowerCase()) {
    if (valid.has(ch) && !uniq.includes(ch)) uniq.push(ch)
  }
  if (!uniq.includes('g')) uniq.unshift('g')
  return uniq.join('')
}

function compileHighlightRules(rules: TerminalHighlightRule[]): { color: string; pattern: RegExp }[] {
  const out: { color: string; pattern: RegExp }[] = []
  for (const rule of rules) {
    if (!rule.pattern?.trim()) continue
    try {
      out.push({ color: rule.color, pattern: new RegExp(rule.pattern, normalizeRegexFlags(rule.flags)) })
    } catch {
      // 忽略非法正则，避免中断渲染
    }
  }
  return out
}

const ANSI_ESCAPE_REGEX = new RegExp(String.raw`\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)`, 'g')

interface UseKeywordHighlightOptions {
  termRef: React.RefObject<Terminal | null>
  profileId?: string | null
}

export function useKeywordHighlight({ termRef }: UseKeywordHighlightOptions) {
  const lineDecorationsRef = useRef<Map<number, IDecoration[]>>(new Map())
  const lastScannedLineRef = useRef(-1)

  useEffect(() => {
    const bindToTerminal = (term: Terminal) => {
      const clearAll = () => {
        for (const decs of lineDecorationsRef.current.values()) {
          for (const d of decs) d.dispose()
        }
        lineDecorationsRef.current.clear()
      }

      const clearLine = (line: number) => {
        const decs = lineDecorationsRef.current.get(line)
        if (decs) {
          for (const d of decs) d.dispose()
          lineDecorationsRef.current.delete(line)
        }
      }

      const getCompiledRules = () => {
        const s = useSettingsStore.getState()
        const source = normalizeTerminalHighlightRules(s.termHighlightRules)
        const compiled = compileHighlightRules(source)
        if (compiled.length > 0) return compiled
        return compileHighlightRules(DEFAULT_TERMINAL_HIGHLIGHT_RULES)
      }

      const scanLine = (lineIndex: number) => {
        const buffer = term.buffer.active
        const line = buffer.getLine(lineIndex)
        if (!line) return
        const text = line.translateToString()
        if (!text.trim()) return
        const plainText = text.replace(ANSI_ESCAPE_REGEX, '')
        if (plainText.trimStart().startsWith('[Vortix]')) return

        if (!useSettingsStore.getState().termHighlightEnhance) return

        const decs: IDecoration[] = []
        const cursorAbsY = buffer.baseY + buffer.cursorY
        const rules = getCompiledRules()

        for (const rule of rules) {
          rule.pattern.lastIndex = 0
          let match: RegExpExecArray | null
          while ((match = rule.pattern.exec(text)) !== null) {
            const marker = term.registerMarker(lineIndex - cursorAbsY)
            if (!marker) continue
            const decoration = term.registerDecoration({
              marker,
              x: match.index,
              width: match[0].length,
              foregroundColor: rule.color,
              layer: 'top',
            })
            if (decoration) decs.push(decoration)
          }
        }

        if (decs.length > 0) {
          lineDecorationsRef.current.set(lineIndex, decs)
        }
      }

      const scanNewLines = () => {
        const buffer = term.buffer.active
        const currentLine = buffer.baseY + buffer.cursorY
        const startLine = Math.max(lastScannedLineRef.current, 0)
        for (let y = startLine; y <= currentLine; y++) {
          clearLine(y)
          scanLine(y)
        }
        lastScannedLineRef.current = currentLine
      }

      const fullRescan = () => {
        clearAll()
        lastScannedLineRef.current = -1
        const buffer = term.buffer.active
        const end = buffer.baseY + buffer.cursorY
        for (let y = 0; y <= end; y++) {
          scanLine(y)
        }
        lastScannedLineRef.current = end
      }

      const writeDisposable = term.onWriteParsed(scanNewLines)
      const unsubSettings = useSettingsStore.subscribe((s, prev) => {
        if (s.termHighlightEnhance !== prev.termHighlightEnhance || s.termHighlightRules !== prev.termHighlightRules) {
          fullRescan()
        }
      })

      fullRescan()

      return () => {
        writeDisposable.dispose()
        unsubSettings()
        clearAll()
      }
    }

    let cleanup: (() => void) | null = null
    let timer: ReturnType<typeof setInterval> | null = null

    const tryBind = () => {
      if (cleanup) return true
      const term = termRef.current
      if (!term) return false
      cleanup = bindToTerminal(term)
      return true
    }

    if (!tryBind()) {
      timer = setInterval(() => {
        if (tryBind() && timer) {
          clearInterval(timer)
          timer = null
        }
      }, 60)
    }

    return () => {
      if (timer) clearInterval(timer)
      cleanup?.()
    }
  }, [termRef])
}
