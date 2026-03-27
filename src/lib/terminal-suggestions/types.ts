export type SuggestionSource = 'history' | 'snippet' | 'command-spec'
export type SuggestionMatchMode = 'strict-prefix' | 'smart' | 'fuzzy'

export type SuggestionKind =
  | 'history'
  | 'snippet'
  | 'command'
  | 'subcommand'
  | 'flag'
  | 'arg'

export type SuggestionInsertMode = 'replace-token' | 'replace-line' | 'append'

export interface SuggestionMatchRange {
  from: number
  to: number
}

export interface SuggestionMeta {
  command?: string
  category?: string
  requiresValue?: boolean
  valueHints?: string[]
}

export interface SuggestionCandidate {
  id: string
  text: string
  displayText: string
  kind: SuggestionKind
  source: SuggestionSource
  score: number
  insertMode: SuggestionInsertMode
  match: SuggestionMatchRange
  description?: string
  meta?: SuggestionMeta
}

export type TerminalConnectionKind = 'local' | 'ssh'

export type TerminalPlatformProfile = 'gnu' | 'bsd' | 'busybox' | 'powershell' | 'unknown'

export interface SuggestionContext {
  input: string
  cursorIndex: number
  matchMode: SuggestionMatchMode
  connectionKind: TerminalConnectionKind
  platformProfile: TerminalPlatformProfile
  recentCommands: string[]
}

export interface SuggestionRequest {
  context: SuggestionContext
  limit?: number
}
