import { BridgeSocketBase } from './bridgeSocketBase'

export class TerminalBridgeSocket extends BridgeSocketBase {
  constructor(sessionId: string) {
    super({
      sessionId,
      eventPrefix: 'terminal-bridge',
      openCommand: 'bridge_terminal_open',
      sendCommand: 'bridge_terminal_send',
      closeCommand: 'bridge_terminal_close',
      supportMessageListeners: true,
    })
  }
}

export function shouldUseTerminalBridge(): boolean {
  return typeof window !== 'undefined' && Boolean((window as unknown as Record<string, unknown>).__TAURI_INTERNALS__)
}

export function createTerminalSessionId(paneId: string): string {
  return `${paneId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
