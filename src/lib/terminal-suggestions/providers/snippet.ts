import { useShortcutStore } from '../../../stores/useShortcutStore'
import type { TreeItem } from '../../../types'
import type { SuggestionProvider } from './base'
import type { SuggestionCandidate, SuggestionRequest } from '../types'

export interface ShortcutSnippetItem {
  id: string
  name: string
  command: string
  remark?: string
}

function appendSnippetFromNode(snippets: ShortcutSnippetItem[], node: TreeItem): void {
  if (node.type === 'folder') {
    for (const child of node.children ?? []) appendSnippetFromNode(snippets, child)
    return
  }
  if (!node.command) return
  snippets.push({
    id: node.id,
    name: node.name,
    command: node.command,
    remark: node.remark,
  })
}

export function collectShortcutSnippets(nodes: TreeItem[]): ShortcutSnippetItem[] {
  const snippets: ShortcutSnippetItem[] = []
  for (const node of nodes) appendSnippetFromNode(snippets, node)
  return snippets
}

function buildSnippetCandidate(snippet: ShortcutSnippetItem, request: SuggestionRequest): SuggestionCandidate {
  return {
    id: `snippet:${snippet.id}`,
    text: snippet.command,
    displayText: snippet.name,
    kind: 'snippet',
    source: 'snippet',
    score: 0,
    insertMode: 'replace-line',
    match: {
      from: 0,
      to: request.context.input.length,
    },
    description: snippet.remark,
  }
}

interface CreateSnippetSuggestionProviderOptions {
  getSnippets?: () => ShortcutSnippetItem[]
  maxItems?: number
}

export function createSnippetSuggestionProvider(
  options: CreateSnippetSuggestionProviderOptions = {},
): SuggestionProvider {
  const getSnippets = options.getSnippets ?? (() => {
    const tree = useShortcutStore.getState().shortcuts
    return collectShortcutSnippets(tree)
  })
  const maxItems = Math.max(1, options.maxItems ?? 100)

  return {
    source: 'snippet',
    provideSuggestions(request) {
      const input = request.context.input.trim().toLowerCase()
      const candidates: SuggestionCandidate[] = []
      const snippets = getSnippets()
      for (const snippet of snippets) {
        const command = snippet.command.trim()
        if (!command) continue
        if (input) {
          const name = snippet.name.toLowerCase()
          const remark = (snippet.remark ?? '').toLowerCase()
          const lowerCommand = command.toLowerCase()
          const hit = lowerCommand.includes(input) || name.includes(input) || remark.includes(input)
          if (!hit) continue
        }
        candidates.push(buildSnippetCandidate(snippet, request))
        if (candidates.length >= maxItems) break
      }
      return candidates
    },
  }
}
