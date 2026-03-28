import { t as translate } from '../../../../i18n'
import type { TerminalSession } from '../../../../stores/terminalSessionRegistry'
import { getReconnectStageText } from '../terminal-connection-state'
import { resetMonitorState } from '../terminal-monitor'
import type { TerminalConnectionSocket, TerminalReconnectSettings, UseTerminalConnectionOptions, WriteInlineFn } from './types'

interface AttachLifecycleHandlersOptions {
  ws: TerminalConnectionSocket
  session: TerminalSession
  settings: TerminalReconnectSettings
  conn: NonNullable<import('../terminal-types').SshTerminalProps['connection']>
  writeInline: WriteInlineFn
  monitorRunningRef: UseTerminalConnectionOptions['monitorRunningRef']
  pendingHostKeyRequestIdRef: UseTerminalConnectionOptions['pendingHostKeyRequestIdRef']
  hasConnectedRef: UseTerminalConnectionOptions['hasConnectedRef']
  connectWsRef: UseTerminalConnectionOptions['connectWsRef']
  setConnectionStageText: UseTerminalConnectionOptions['setConnectionStageText']
  setPendingHostKeyPrompt: UseTerminalConnectionOptions['setPendingHostKeyPrompt']
  setConnectionErrorText: UseTerminalConnectionOptions['setConnectionErrorText']
  updateTerminalStatus: UseTerminalConnectionOptions['updateTerminalStatus']
}

export function attachLifecycleHandlers({
  ws,
  session,
  settings,
  conn,
  writeInline,
  monitorRunningRef,
  pendingHostKeyRequestIdRef,
  hasConnectedRef,
  connectWsRef,
  setConnectionStageText,
  setPendingHostKeyPrompt,
  setConnectionErrorText,
  updateTerminalStatus,
}: AttachLifecycleHandlersOptions) {
  const { term } = session

  ws.onclose = () => {
    if (session.ws !== ws) return
    resetMonitorState(monitorRunningRef)
    setConnectionStageText('')
    setPendingHostKeyPrompt(null)
    pendingHostKeyRequestIdRef.current = null
    if (session.isManualDisconnect) return
    if (!hasConnectedRef.current) {
      setConnectionErrorText(translate('connectionLoading.error.websocketClosedBeforeEstablished'))
      writeInline(translate('connectionLoading.error.websocketClosedBeforeEstablished'), 'warn')
    } else {
      term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m WebSocket disconnected')
    }
    updateTerminalStatus('closed')

    const maxRetries = settings.autoReconnect ? settings.reconnectCount : 0
    const interval = settings.reconnectInterval * 1000
    if (session.reconnectCount < maxRetries) {
      session.reconnectCount++
      setConnectionStageText(getReconnectStageText(session.reconnectCount, maxRetries))
      writeInline(getReconnectStageText(session.reconnectCount, maxRetries), 'warn')
      setConnectionErrorText('')
      updateTerminalStatus('connecting')
      session.reconnectTimer = setTimeout(() => {
        session.reconnectTimer = null
        if (session.ws === ws) connectWsRef.current?.(session, conn)
      }, interval)
      return
    }

    setConnectionErrorText(translate('connectionLoading.error.pressAnyKeyReconnect'))
    writeInline(translate('connectionLoading.error.pressAnyKeyReconnect'), 'warn')
    session.reconnectInputDisposable?.dispose()
    session.reconnectInputDisposable = term.onData(() => {
      session.reconnectInputDisposable?.dispose()
      session.reconnectInputDisposable = null
      session.reconnectCount = 0
      setConnectionStageText(getReconnectStageText(0, 0))
      setConnectionErrorText('')
      updateTerminalStatus('connecting')
      connectWsRef.current?.(session, conn)
    })
  }

  ws.onerror = () => {
    if (session.ws !== ws) return
    setConnectionStageText('')
    setPendingHostKeyPrompt(null)
    pendingHostKeyRequestIdRef.current = null
    setConnectionErrorText(translate('connectionLoading.error.websocketFailed'))
    writeInline(translate('connectionLoading.error.websocketFailed'), 'error')
    if (hasConnectedRef.current) {
      term.writeln('\r\n\x1b[31m[Vortix]\x1b[0m WebSocket connection failed. Check whether the backend service is running.')
    }
    updateTerminalStatus('error')
  }
}
