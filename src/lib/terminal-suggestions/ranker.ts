import type { SuggestionCandidate, SuggestionRequest } from './types'

function tokenAtCursor(input: string, cursorIndex: number): string {
  const safeCursor = Math.max(0, Math.min(cursorIndex, input.length))
  const left = input.slice(0, safeCursor)
  const start = left.lastIndexOf(' ') + 1
  return left.slice(start)
}

function calcMatchScore(input: string, cursorToken: string, candidate: SuggestionCandidate): number {
  const text = candidate.text.toLowerCase()
  const full = input.trim().toLowerCase()
  const token = cursorToken.toLowerCase()

  if (token && text.startsWith(token)) return 120
  if (token && text.includes(token)) return 80
  if (full && text.startsWith(full)) return 60
  return 20
}

function calcSourceScore(candidate: SuggestionCandidate): number {
  switch (candidate.source) {
    case 'history':
      return 20
    case 'snippet':
      return 16
    case 'command-spec':
      return 14
    default:
      return 0
  }
}

function calcKindBoost(input: string, cursorToken: string, candidate: SuggestionCandidate): number {
  if ((cursorToken.startsWith('-') || input.endsWith(' -') || input.endsWith(' --')) && candidate.kind === 'flag') {
    return 30
  }
  if (input.endsWith(' ') && candidate.kind === 'subcommand') {
    return 18
  }
  return 0
}

export function scoreSuggestionCandidate(
  candidate: SuggestionCandidate,
  request: SuggestionRequest,
): SuggestionCandidate {
  const cursorToken = tokenAtCursor(request.context.input, request.context.cursorIndex)
  const total =
    (candidate.score || 0)
    + calcMatchScore(request.context.input, cursorToken, candidate)
    + calcSourceScore(candidate)
    + calcKindBoost(request.context.input, cursorToken, candidate)

  return {
    ...candidate,
    score: total,
  }
}

export function rankSuggestionCandidates(
  candidates: SuggestionCandidate[],
  request: SuggestionRequest,
): SuggestionCandidate[] {
  return candidates
    .map((candidate) => scoreSuggestionCandidate(candidate, request))
    .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text))
}
