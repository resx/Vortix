import { createHistorySuggestionProvider } from './providers/history'
import { createSnippetSuggestionProvider } from './providers/snippet'
import { createCommandSpecSuggestionProvider } from './providers/command-spec'
import type { SuggestionProvider } from './providers/base'
import type { SuggestionSource } from './types'

export function createDefaultSuggestionProviders(): SuggestionProvider[] {
  return [
    createHistorySuggestionProvider(),
    createSnippetSuggestionProvider(),
    createCommandSpecSuggestionProvider(),
  ]
}

export function createSuggestionProvidersBySources(sources: SuggestionSource[]): SuggestionProvider[] {
  const allow = new Set<SuggestionSource>(sources)
  return createDefaultSuggestionProviders().filter((provider) => allow.has(provider.source))
}
