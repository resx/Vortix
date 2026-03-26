import type { SuggestionProvider } from './base'
import type { SuggestionCandidate, SuggestionRequest } from '../types'

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

  return {
    source: 'history',
    provideSuggestions(request) {
      const input = request.context.input.trim().toLowerCase()
      const deduped = new Set<string>()
      const candidates: SuggestionCandidate[] = []
      let index = 0
      for (const command of request.context.recentCommands) {
        const trimmed = command.trim()
        if (!trimmed || deduped.has(trimmed)) continue
        deduped.add(trimmed)
        if (input && !trimmed.toLowerCase().includes(input)) continue
        candidates.push(buildHistoryCandidate(trimmed, request, index))
        index += 1
        if (candidates.length >= maxItems) break
      }
      return candidates
    },
  }
}
