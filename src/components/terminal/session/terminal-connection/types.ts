import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ConnectionLoadingStep } from '../../ConnectionLoadingView'
import type { ResolvedTerminalHighlightRule } from '../../../../lib/terminal-highlight/resolver'
import type { TerminalSocketLike, TerminalSession } from '../../../../stores/terminalSessionRegistry'
import type { HostKeyVerificationPayload, SshTerminalProps } from '../terminal-types'
import type { TerminalBridgeSocket } from '../../../../lib/terminalBridgeSocket'

export interface UseTerminalConnectionOptions {
  paneId: string
  connectionId?: string | null
  connectionName?: string | null
  resolvedWsUrl: string
  showRealtimeInfo: boolean
  tabId?: string
  wsRef: MutableRefObject<TerminalSocketLike | null>
  getProposedDimensions: (term: TerminalSession['term'], fitAddon?: TerminalSession['fitAddon']) => { cols: number; rows: number } | undefined
  getResolvedHighlightRules: () => ResolvedTerminalHighlightRule[]
  safeFit: (session: TerminalSession) => void
  updateTerminalStatus: (status: 'connecting' | 'connected' | 'closed' | 'error') => void
  setConnectionErrorText: Dispatch<SetStateAction<string>>
  setPendingHostKeyPrompt: Dispatch<SetStateAction<HostKeyVerificationPayload | null>>
  setConnectionStageText: Dispatch<SetStateAction<string>>
  setConnectionSteps: Dispatch<SetStateAction<ConnectionLoadingStep[]>>
  hasConnectedRef: MutableRefObject<boolean>
  monitorRunningRef: MutableRefObject<boolean>
  pendingHostKeyRequestIdRef: MutableRefObject<string | null>
  connectWsRef: MutableRefObject<((session: TerminalSession, conn: NonNullable<SshTerminalProps['connection']>) => void) | null>
}

export type WriteInlineFn = (text: string, kind?: 'info' | 'warn' | 'error') => void
export type TerminalConnectionSocket = WebSocket | TerminalBridgeSocket

export interface TerminalReconnectSettings {
  autoReconnect: boolean
  reconnectCount: number
  reconnectInterval: number
}
