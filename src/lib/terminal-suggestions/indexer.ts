import { rankSuggestionCandidates } from './ranker'
import type { SuggestionProvider } from './providers/base'
import type { SuggestionCandidate, SuggestionRequest } from './types'

function buildDedupKey(candidate: SuggestionCandidate): string {
  return `${candidate.text}::${candidate.kind}`
}

function dedupeCandidates(candidates: SuggestionCandidate[]): SuggestionCandidate[] {
  const deduped = new Map<string, SuggestionCandidate>()
  for (const candidate of candidates) {
    const key = buildDedupKey(candidate)
    const current = deduped.get(key)
    if (!current || candidate.score > current.score) {
      deduped.set(key, candidate)
    }
  }
  return [...deduped.values()]
}

export async function collectSuggestionCandidates(
  providers: SuggestionProvider[],
  request: SuggestionRequest,
): Promise<SuggestionCandidate[]> {
  const all = await Promise.all(
    providers.map((provider) => Promise.resolve(provider.provideSuggestions(request))),
  )
  return all.flat()
}

export async function buildSuggestionIndex(
  providers: SuggestionProvider[],
  request: SuggestionRequest,
): Promise<SuggestionCandidate[]> {
  const collected = await collectSuggestionCandidates(providers, request)
  const deduped = dedupeCandidates(collected)
  const ranked = rankSuggestionCandidates(deduped, request)
  if (!request.limit || request.limit <= 0) return ranked
  return ranked.slice(0, request.limit)
}
