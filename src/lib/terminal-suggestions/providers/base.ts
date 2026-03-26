import type { SuggestionCandidate, SuggestionRequest } from '../types'

export interface SuggestionProvider {
  source: SuggestionCandidate['source']
  provideSuggestions(request: SuggestionRequest): Promise<SuggestionCandidate[]> | SuggestionCandidate[]
}
