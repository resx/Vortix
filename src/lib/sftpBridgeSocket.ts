import { BridgeSocketBase } from './bridgeSocketBase'

export class SftpBridgeSocket extends BridgeSocketBase {
  constructor(sessionId: string) {
    super({
      sessionId,
      eventPrefix: 'sftp-bridge',
      openCommand: 'bridge_sftp_open',
      sendCommand: 'bridge_sftp_send',
      closeCommand: 'bridge_sftp_close',
    })
  }
}

export function createSftpSessionId(): string {
  return `sftp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
