import { useCallback } from 'react'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { t as translate } from '../../../i18n'
import {
  createTerminalSessionId,
  shouldUseTerminalBridge,
  TerminalBridgeSocket,
} from '../../../lib/terminalBridgeSocket'
import { attachLifecycleHandlers } from './terminal-connection/attachLifecycleHandlers'
import { attachMessageHandler } from './terminal-connection/attachMessageHandler'
import { createWriteInline } from './terminal-connection/writeInline'
import type { TerminalSession } from '../../../stores/terminalSessionRegistry'
import type { SshConnection, SshTerminalProps } from './terminal-types'
import type { UseTerminalConnectionOptions } from './terminal-connection/types'

export function useTerminalConnection({
  paneId,
  connectionId,
  connectionName,
  resolvedWsUrl,
  showRealtimeInfo,
  tabId,
  wsRef,
  getProposedDimensions,
  getResolvedHighlightRules,
  safeFit,
  updateTerminalStatus,
  setConnectionErrorText,
  setPendingHostKeyPrompt,
  setConnectionStageText,
  setConnectionSteps,
  hasConnectedRef,
  monitorRunningRef,
  pendingHostKeyRequestIdRef,
  connectWsRef,
}: UseTerminalConnectionOptions) {
  return useCallback((session: TerminalSession, conn: NonNullable<SshTerminalProps['connection']>) => {
    const settings = useSettingsStore.getState()
    const { term, fitAddon } = session
    const isLocal = 'type' in conn && conn.type === 'local'
    const sshConn = isLocal ? null : conn as SshConnection
    const lastInlineStageTextRef = { current: '' }
    const writeInline = createWriteInline(term)

    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer)
      session.reconnectTimer = null
    }
    session.highlightLineTail = ''
    session.reconnectInputDisposable?.dispose()
    session.reconnectInputDisposable = null

    const ws = shouldUseTerminalBridge()
      ? new TerminalBridgeSocket(createTerminalSessionId(paneId))
      : new WebSocket(resolvedWsUrl)
    session.ws = ws
    wsRef.current = ws

    ws.onopen = () => {
      if (session.ws !== ws) return
      session.reconnectCount = 0
      session.shellIntegrationHistory = false
      hasConnectedRef.current = false
      updateTerminalStatus('connecting')
      setConnectionErrorText('')
      setPendingHostKeyPrompt(null)
      setConnectionSteps([])
      setConnectionStageText(
        sshConn?.jump
          ? `${translate('connectionLoading.phase.connecting')} ${translate('connectionLoading.role.jump')} ${sshConn.jump.connectionName || sshConn.jump.host}:${sshConn.jump.port}`
          : sshConn
            ? `${translate('connectionLoading.phase.connecting')} ${translate('connectionLoading.role.target')} ${sshConn.host}:${sshConn.port}`
            : translate('connectionLoading.phase.startingLocal'),
      )
      term.clear()
      writeInline(translate('connectionLoading.preparing'))
      if (sshConn?.jump) {
        writeInline(`${translate('connectionLoading.phase.connecting')} ${translate('connectionLoading.role.jump')} ${sshConn.jump.connectionName || sshConn.jump.host}:${sshConn.jump.port}`)
      } else if (sshConn) {
        writeInline(`${translate('connectionLoading.phase.connecting')} ${translate('connectionLoading.role.target')} ${sshConn.host}:${sshConn.port}`)
      } else {
        writeInline(translate('connectionLoading.phase.startingLocal'))
      }
      safeFit(session)
      const dims = getProposedDimensions(term, fitAddon)
      if (isLocal) {
        ws.send(JSON.stringify({
          type: 'connect',
          data: {
            type: 'local',
            shell: conn.shell,
            workingDir: conn.workingDir,
            initialCommand: conn.initialCommand,
            cols: dims?.cols,
            rows: dims?.rows,
          },
        }))
      } else {
        ws.send(JSON.stringify({
          type: 'connect',
          data: { ...conn, connectionId, connectionName, cols: dims?.cols, rows: dims?.rows },
        }))
      }
    }

    attachMessageHandler({
      ws,
      session,
      fitAddon,
      isLocal,
      sshConn,
      connectionId,
      showRealtimeInfo,
      tabId,
      lastInlineStageTextRef,
      writeInline,
      monitorRunningRef,
      hasConnectedRef,
      pendingHostKeyRequestIdRef,
      setConnectionStageText,
      setConnectionSteps,
      setPendingHostKeyPrompt,
      setConnectionErrorText,
      updateTerminalStatus,
      safeFit,
      getProposedDimensions,
      getResolvedHighlightRules,
    })

    attachLifecycleHandlers({
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
    })
  }, [
    paneId,
    connectionId,
    connectionName,
    connectWsRef,
    getProposedDimensions,
    getResolvedHighlightRules,
    hasConnectedRef,
    monitorRunningRef,
    pendingHostKeyRequestIdRef,
    resolvedWsUrl,
    safeFit,
    setConnectionErrorText,
    setConnectionStageText,
    setConnectionSteps,
    setPendingHostKeyPrompt,
    showRealtimeInfo,
    tabId,
    updateTerminalStatus,
    wsRef,
  ])
}
