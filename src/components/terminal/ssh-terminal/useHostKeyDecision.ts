import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { TerminalSocketLike } from '../../../stores/terminalSessionRegistry'
import type { HostKeyVerificationPayload } from '../session/terminal-types'

interface UseHostKeyDecisionOptions {
  wsRef: MutableRefObject<TerminalSocketLike | null>
  pendingHostKeyRequestIdRef: MutableRefObject<string | null>
  setPendingHostKeyPrompt: Dispatch<SetStateAction<HostKeyVerificationPayload | null>>
}

export function useHostKeyDecision({
  wsRef,
  pendingHostKeyRequestIdRef,
  setPendingHostKeyPrompt,
}: UseHostKeyDecisionOptions) {
  return useCallback((decision: 'trust' | 'replace' | 'reject') => {
    const requestId = pendingHostKeyRequestIdRef.current
    pendingHostKeyRequestIdRef.current = null
    setPendingHostKeyPrompt(null)
    const ws = wsRef.current
    if (!requestId || ws?.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type: 'hostkey-verification-decision',
      data: {
        requestId,
        trust: decision !== 'reject',
        replaceExisting: decision === 'replace',
      },
    }))
  }, [pendingHostKeyRequestIdRef, setPendingHostKeyPrompt, wsRef])
}
