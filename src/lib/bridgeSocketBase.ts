import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface BridgePayload {
  type: string
  data?: unknown
  requestId?: string
}

export interface MessageLikeEvent {
  data: string
}

interface BridgeSocketOptions {
  sessionId: string
  eventPrefix: string
  openCommand: string
  sendCommand: string
  closeCommand: string
  supportMessageListeners?: boolean
}

export class BridgeSocketBase {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly sessionId: string
  readonly eventPrefix: string
  readonly openCommand: string
  readonly sendCommand: string
  readonly closeCommand: string
  readonly supportMessageListeners: boolean

  readyState = BridgeSocketBase.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageLikeEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  private unlisten: UnlistenFn | null = null
  private messageListeners = new Set<(event: MessageEvent) => void>()

  constructor(options: BridgeSocketOptions) {
    this.sessionId = options.sessionId
    this.eventPrefix = options.eventPrefix
    this.openCommand = options.openCommand
    this.sendCommand = options.sendCommand
    this.closeCommand = options.closeCommand
    this.supportMessageListeners = options.supportMessageListeners ?? false
    void this.bootstrap()
  }

  send(raw: string): void {
    if (this.readyState !== BridgeSocketBase.OPEN) return
    let payload: BridgePayload
    try {
      payload = JSON.parse(raw) as BridgePayload
    } catch {
      this.onerror?.(new Event('error'))
      return
    }
    void invoke(this.sendCommand, {
      sessionId: this.sessionId,
      payload: {
        type: payload.type,
        data: payload.data ?? null,
        requestId: payload.requestId ?? null,
      },
    }).catch(() => this.onerror?.(new Event('error')))
  }

  close(): void {
    if (this.readyState === BridgeSocketBase.CLOSED || this.readyState === BridgeSocketBase.CLOSING) return
    this.readyState = BridgeSocketBase.CLOSING
    const finish = () => {
      this.readyState = BridgeSocketBase.CLOSED
      this.unlisten?.()
      this.unlisten = null
      this.onclose?.(new CloseEvent('close'))
    }
    void invoke(this.closeCommand, { sessionId: this.sessionId }).finally(finish)
  }

  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void {
    if (!this.supportMessageListeners) return
    if (type === 'message') this.messageListeners.add(listener)
  }

  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void {
    if (!this.supportMessageListeners) return
    if (type === 'message') this.messageListeners.delete(listener)
  }

  private async bootstrap(): Promise<void> {
    try {
      const eventName = `${this.eventPrefix}://${this.sessionId}`
      this.unlisten = await listen(eventName, (event) => {
        if (this.readyState !== BridgeSocketBase.OPEN) return
        const data = JSON.stringify(event.payload ?? {})
        this.emitMessage(data)
      })
      await invoke(this.openCommand, { sessionId: this.sessionId })
      this.readyState = BridgeSocketBase.OPEN
      this.onopen?.(new Event('open'))
    } catch {
      this.readyState = BridgeSocketBase.CLOSED
      this.unlisten?.()
      this.unlisten = null
      this.onerror?.(new Event('error'))
      this.onclose?.(new CloseEvent('close'))
    }
  }

  private emitMessage(data: string): void {
    this.onmessage?.({ data })
    if (!this.supportMessageListeners || this.messageListeners.size === 0) return
    const event = new MessageEvent('message', { data })
    this.messageListeners.forEach((listener) => listener(event))
  }
}
