import type { ConnectionLoadingHostKeyPrompt } from '../ConnectionLoadingView'

export interface JumpConnection {
  connectionId?: string
  connectionName?: string
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
}

export interface SshConnection {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  terminalEnhance?: boolean
  jump?: JumpConnection
}

export interface LocalConnection {
  type: 'local'
  shell: string
  workingDir?: string
  initialCommand?: string
}

export type TerminalConnection = SshConnection | LocalConnection

export interface SshTerminalProps {
  paneId: string
  tabId?: string
  wsUrl?: string
  connection: TerminalConnection | null
  connectionId?: string | null
  connectionName?: string | null
  profileId?: string | null
  onStatusChange?: (status: 'connecting' | 'connected' | 'closed' | 'error') => void
  onContextMenu?: (x: number, y: number, hasSelection: boolean) => void
}

export interface ConnectionStagePayload {
  role?: 'jump' | 'target'
  phase?: string
  host?: string
  port?: number
  username?: string
  connectionId?: string | null
  connectionName?: string | null
  hopIndex?: number
  hopCount?: number
}

export interface HostKeyVerificationPayload extends ConnectionLoadingHostKeyPrompt {
  requestId: string
}
