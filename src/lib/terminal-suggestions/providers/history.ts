import type { SuggestionProvider } from './base'
import type { SuggestionCandidate, SuggestionRequest } from '../types'
import { getHistorySuggestions } from '../../../api/client'

interface CreateHistorySuggestionProviderOptions {
  maxItems?: number
}

function buildHistoryCandidate(command: string, request: SuggestionRequest, index: number): SuggestionCandidate {
  return {
    id: `history:${index}:${command}`,
    text: command,
    displayText: command,
    kind: 'history',
    source: 'history',
    score: 0,
    insertMode: 'replace-line',
    match: {
      from: 0,
      to: request.context.input.length,
    },
  }
}

export function createHistorySuggestionProvider(
  options: CreateHistorySuggestionProviderOptions = {},
): SuggestionProvider {
  const maxItems = Math.max(1, options.maxItems ?? 200)
  const cache = new Map<string, { ts: number; rows: string[] }>()

  return {
    source: 'history',
    async provideSuggestions(request) {
      const input = request.context.input.trim().toLowerCase()
      const deduped = new Set<string>()
      const candidates: SuggestionCandidate[] = []
      const runtimeLimit = Math.max(1, Math.min(maxItems, request.limit ?? maxItems))
      let sourceRows: string[] = []

      const connectionId = request.context.connectionId
      if (connectionId) {
        const cacheKey = `${connectionId}:${input}:${runtimeLimit}`
        const cached = cache.get(cacheKey)
        if (cached && Date.now() - cached.ts < 10_000) {
          sourceRows = cached.rows
        } else {
          try {
            const rows = await getHistorySuggestions(connectionId, input, runtimeLimit)
            sourceRows = rows.map((item) => item.command)
            cache.set(cacheKey, { ts: Date.now(), rows: sourceRows })
            if (cache.size > 100) {
              const first = cache.keys().next().value
              if (first) cache.delete(first)
            }
          } catch {
            sourceRows = []
          }
        }
      }

      if (sourceRows.length === 0) sourceRows = request.context.recentCommands

      let index = 0
      for (const command of sourceRows) {
        const trimmed = command.trim()
        if (!trimmed || deduped.has(trimmed)) continue
        deduped.add(trimmed)
        if (input && !trimmed.toLowerCase().includes(input)) continue
        candidates.push(buildHistoryCandidate(trimmed, request, index))
        index += 1
        if (candidates.length >= runtimeLimit) break
      }
      return candidates
    },
  }
}
