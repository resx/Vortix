import type { TerminalSession } from '../../../stores/terminalSessionRegistry'
import type {
  SuggestionMatchMode,
  SuggestionRequest,
  TerminalConnectionKind,
  TerminalPlatformProfile,
} from '../../../lib/terminal-suggestions'

interface BuildTerminalSuggestionRequestOptions {
  connectionKind: TerminalConnectionKind
  matchMode: SuggestionMatchMode
  platformProfile?: TerminalPlatformProfile
  limit?: number
}

export function buildTerminalSuggestionRequest(
  session: TerminalSession,
  options: BuildTerminalSuggestionRequestOptions,
): SuggestionRequest {
  const cursorIndex = session.commandBuffer.length
  return {
    context: {
      input: session.commandBuffer,
      cursorIndex,
      matchMode: options.matchMode,
      connectionKind: options.connectionKind,
      platformProfile: options.platformProfile ?? 'unknown',
      recentCommands: [...session.historyCache],
    },
    limit: options.limit,
  }
}
