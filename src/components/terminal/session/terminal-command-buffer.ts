import type { Terminal } from '@xterm/xterm'
import type { TerminalSession } from '../../../stores/terminalSessionRegistry'

export function clearPendingTabCompletion(session: TerminalSession): void {
  session.pendingTabCompletion = false
  session.pendingTabCompletionBuffer = ''
}

function getCurrentInputLineText(term: Terminal): string {
  const buffer = term.buffer.active
  const absoluteY = buffer.baseY + buffer.cursorY
  if (absoluteY < 0) return ''

  let startY = absoluteY
  while (startY > 0) {
    const line = buffer.getLine(startY)
    if (!line?.isWrapped) break
    startY -= 1
  }

  let text = ''
  for (let y = startY; y <= absoluteY; y += 1) {
    const line = buffer.getLine(y)
    if (!line) continue
    const raw = line.translateToString(false)
    text += y === absoluteY ? raw.slice(0, buffer.cursorX) : raw
  }
  return text
}

export function syncPendingTabCompletionFromTerminal(session: TerminalSession): void {
  if (!session.pendingTabCompletion) return

  const snapshot = session.pendingTabCompletionBuffer
  if (!snapshot) {
    clearPendingTabCompletion(session)
    return
  }

  const visibleLine = getCurrentInputLineText(session.term)
  if (!visibleLine) return

  const start = visibleLine.lastIndexOf(snapshot)
  if (start === -1) return

  const nextBuffer = visibleLine.slice(start)
  if (nextBuffer.length < snapshot.length) return

  session.commandBuffer = nextBuffer
  clearPendingTabCompletion(session)
}

export function syncCommandBufferFromTerminalBeforeSubmit(session: TerminalSession): void {
  if (!session.pendingTabCompletion) return
  syncPendingTabCompletionFromTerminal(session)
}
