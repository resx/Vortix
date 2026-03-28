import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildSuggestionIndex,
  createSuggestionProvidersBySources,
  type SuggestionCandidate,
  type SuggestionMatchMode,
  type SuggestionSource,
  type TerminalConnectionKind,
  type TerminalPlatformProfile,
} from '../../../lib/terminal-suggestions'
import { addInputListener, getSession, removeInputListener } from '../../../stores/terminalSessionRegistry'
import { buildTerminalSuggestionRequest } from '../session/terminal-suggestion-context'
import { clearPendingTabCompletion } from '../session/terminal-command-buffer'
import { getCursorPixelCoords, type CursorPixelCoords } from './cursor-position'

interface UseTerminalSuggestionsOptions {
  paneId: string
  enabled: boolean
  matchMode: SuggestionMatchMode
  enabledSources: SuggestionSource[]
  connectionKind: TerminalConnectionKind
  connectionId?: string | null
  platformProfile?: TerminalPlatformProfile
  limit?: number
}

interface UseTerminalSuggestionsResult {
  visible: boolean
  candidates: SuggestionCandidate[]
  activeIndex: number
  activeCandidate: SuggestionCandidate | null
  cursorCoords: CursorPixelCoords | null
  refresh: () => Promise<void>
  close: () => void
  selectIndex: (index: number) => void
  selectNext: () => void
  selectPrev: () => void
  acceptActive: () => boolean
  acceptIndex: (index: number) => boolean
  handleKeyDown: (event: KeyboardEvent) => boolean
}

function clampIndex(index: number, total: number): number {
  if (total <= 0) return -1
  if (index < 0) return 0
  if (index >= total) return total - 1
  return index
}

function findCommonPrefixLength(left: string, right: string): number {
  const maxLen = Math.min(left.length, right.length)
  let i = 0
  while (i < maxLen && left[i] === right[i]) i += 1
  return i
}

function buildInputDelta(current: string, next: string): string {
  const prefix = findCommonPrefixLength(current, next)
  const deleteCount = Math.max(0, current.length - prefix)
  const backspaces = '\x7f'.repeat(deleteCount)
  const insertText = next.slice(prefix)
  return backspaces + insertText
}

function shouldAppendTrailingSpace(candidate: SuggestionCandidate): boolean {
  if (candidate.source !== 'command-spec') return false
  return candidate.kind === 'command' || candidate.kind === 'subcommand' || candidate.kind === 'flag'
}

function splitLastToken(input: string): string {
  const safe = input.trimStart()
  const parts = safe.split(/\s+/).filter(Boolean)
  return parts.at(-1) ?? ''
}

function isSubsequence(needle: string, haystack: string): boolean {
  if (!needle) return true
  let i = 0
  for (let j = 0; j < haystack.length && i < needle.length; j += 1) {
    if (needle[i] === haystack[j]) i += 1
  }
  return i === needle.length
}

function matchCandidateByMode(candidate: SuggestionCandidate, input: string, mode: SuggestionMatchMode): boolean {
  const query = input.trim().toLowerCase()
  if (!query) return true
  const token = splitLastToken(input).toLowerCase()
  const text = candidate.text.toLowerCase()
  const display = candidate.displayText.toLowerCase()
  const desc = (candidate.description ?? '').toLowerCase()

  if (mode === 'strict-prefix') {
    return text.startsWith(query) || display.startsWith(query) || (token ? text.startsWith(token) || display.startsWith(token) : false)
  }
  if (mode === 'fuzzy') {
    return (
      text.startsWith(query)
      || display.startsWith(query)
      || isSubsequence(query, text)
      || isSubsequence(query, display)
      || (desc ? isSubsequence(query, desc) : false)
    )
  }
  return (
    text.startsWith(query)
    || display.startsWith(query)
    || text.includes(query)
    || display.includes(query)
    || (token ? text.startsWith(token) || display.startsWith(token) : false)
    || (desc ? desc.includes(query) : false)
  )
}

export function useTerminalSuggestions({
  paneId,
  enabled,
  matchMode,
  enabledSources,
  connectionKind,
  connectionId,
  platformProfile = 'unknown',
  limit = 12,
}: UseTerminalSuggestionsOptions): UseTerminalSuggestionsResult {
  const providers = useMemo(
    () => createSuggestionProvidersBySources(enabledSources),
    [enabledSources],
  )
  const [visible, setVisible] = useState(false)
  const [candidates, setCandidates] = useState<SuggestionCandidate[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [cursorCoords, setCursorCoords] = useState<CursorPixelCoords | null>(null)

  const refresh = useCallback(async () => {
    const session = getSession(paneId)
    if (!session || !enabled) {
      setVisible(false)
      setCandidates([])
      setActiveIndex(-1)
      return
    }
    if (session.inFullscreenEditor) {
      setVisible(false)
      setCandidates([])
      setActiveIndex(-1)
      return
    }

    const request = buildTerminalSuggestionRequest(session, {
      connectionKind,
      connectionId,
      matchMode,
      platformProfile,
      limit,
    })
    const nextCandidates = (await buildSuggestionIndex(providers, request))
      .filter((candidate) => matchCandidateByMode(candidate, session.commandBuffer, matchMode))
    setCursorCoords(getCursorPixelCoords(session.term))
    if (nextCandidates.length === 0 || !session.commandBuffer.trim()) {
      setVisible(false)
      setCandidates([])
      setActiveIndex(-1)
      return
    }
    setVisible(true)
    setCandidates(nextCandidates)
    setActiveIndex((prev) => clampIndex(prev < 0 ? 0 : prev, nextCandidates.length))
  }, [connectionId, connectionKind, enabled, limit, matchMode, paneId, platformProfile, providers])

  const close = () => {
    setVisible(false)
    setCandidates([])
    setActiveIndex(-1)
  }

  const selectNext = () => {
    if (candidates.length <= 0) return
    setActiveIndex((prev) => (prev + 1) % candidates.length)
  }

  const selectPrev = () => {
    if (candidates.length <= 0) return
    setActiveIndex((prev) => (prev - 1 + candidates.length) % candidates.length)
  }

  const selectIndex = (index: number) => {
    if (candidates.length <= 0) return
    setActiveIndex(clampIndex(index, candidates.length))
  }

  const acceptIndex = (index: number): boolean => {
    if (candidates.length <= 0) return false
    const safeIndex = clampIndex(index, candidates.length)
    if (safeIndex < 0) return false
    setActiveIndex(safeIndex)
    const session = getSession(paneId)
    if (!session || !visible) return false
    const candidate = candidates[safeIndex]
    if (!candidate) return false
    const ws = session.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    const normalizedNext = shouldAppendTrailingSpace(candidate) && !candidate.text.endsWith(' ')
      ? `${candidate.text} `
      : candidate.text
    const delta = buildInputDelta(session.commandBuffer, normalizedNext)
    if (!delta) {
      close()
      return false
    }
    ws.send(JSON.stringify({ type: 'input', data: delta }))
    session.commandBuffer = normalizedNext
    clearPendingTabCompletion(session)
    close()
    return true
  }

  const acceptActive = (): boolean => {
    return acceptIndex(activeIndex)
  }

  const handleKeyDown = (event: KeyboardEvent): boolean => {
    if (!enabled) return false
    const session = getSession(paneId)
    if (session?.inFullscreenEditor) {
      if (visible) close()
      return false
    }
    if (event.key === 'Escape' && visible) {
      event.preventDefault()
      event.stopPropagation()
      close()
      return true
    }
    if (event.key === 'ArrowDown' && visible) {
      event.preventDefault()
      event.stopPropagation()
      selectNext()
      return true
    }
    if (event.key === 'ArrowUp' && visible) {
      event.preventDefault()
      event.stopPropagation()
      selectPrev()
      return true
    }
    if (event.key === 'Tab' && visible) {
      const accepted = acceptActive()
      if (accepted) {
        event.preventDefault()
        event.stopPropagation()
        return true
      }
    }
    if (event.key === 'Enter' && visible) {
      const accepted = acceptActive()
      if (accepted) {
        event.preventDefault()
        event.stopPropagation()
        return true
      }
    }
    return false
  }

  useEffect(() => {
    if (!enabled) return

    const listener = () => {
      void refresh()
    }
    addInputListener(paneId, listener)
    return () => removeInputListener(paneId, listener)
  }, [enabled, paneId, refresh])

  useEffect(() => {
    if (!enabled) return
    const session = getSession(paneId)
    if (!session) return

    const disposable = session.term.onCursorMove(() => {
      setCursorCoords(getCursorPixelCoords(session.term))
    })

    return () => disposable.dispose()
  }, [enabled, paneId])

  const effectiveVisible = enabled && visible
  const effectiveCandidates = enabled ? candidates : []
  const effectiveActiveIndex = enabled ? activeIndex : -1

  return {
    visible: effectiveVisible,
    candidates: effectiveCandidates,
    activeIndex: effectiveActiveIndex,
    activeCandidate: effectiveActiveIndex >= 0 ? (effectiveCandidates[effectiveActiveIndex] ?? null) : null,
    cursorCoords: enabled ? cursorCoords : null,
    refresh,
    close,
    selectNext,
    selectPrev,
    acceptActive,
    selectIndex,
    acceptIndex,
    handleKeyDown,
  }
}
