import { getSession } from '../../../stores/terminalSessionRegistry'

const BRACKETED_PASTE_BEGIN = '\u001b[200~'
const BRACKETED_PASTE_END = '\u001b[201~'

function normalizeClipboardText(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function encodeTerminalPastePayload(raw: string): string {
  const normalized = normalizeClipboardText(raw)
  if (!normalized) return ''
  return `${BRACKETED_PASTE_BEGIN}${normalized}${BRACKETED_PASTE_END}`
}

export function pasteTextToSession(paneId: string, raw: string): void {
  const current = getSession(paneId)
  if (!raw || current?.ws?.readyState !== WebSocket.OPEN) return
  const payload = encodeTerminalPastePayload(raw)
  if (!payload) return
  current.ws.send(JSON.stringify({ type: 'input', data: payload }))
}

