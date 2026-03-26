import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { useTabStore } from '../../../stores/useTabStore'
import { addHistory } from '../../../api/client'
import { t as translate } from '../../../i18n'
import { handleMonitorMessage, resetMonitorState, startMonitorIfNeeded } from './terminal-monitor'
import { describeConnectionStage, nextConnectionSteps } from './terminal-connection-state'
import {
  applyAnsiSafeHighlight,
  endsWithExplicitLineBreak,
  ensureCursorVisibleBeforePrompt,
  normalizeProtectedOutputAfterCommandStart,
  normalizeOutputBeforePrompt,
  shouldPreserveTerminalOutput,
} from './terminal-output'
import { syncPendingTabCompletionFromTerminal } from './terminal-command-buffer'
import type { ConnectionLoadingStep } from '../ConnectionLoadingView'
import type { TerminalSession } from '../../../stores/terminalSessionRegistry'
import type { ConnectionStagePayload, HostKeyVerificationPayload, SshConnection, SshTerminalProps } from './terminal-types'

interface UseTerminalConnectionOptions {
  connectionId?: string | null
  connectionName?: string | null
  resolvedWsUrl: string
  showRealtimeInfo: boolean
  tabId?: string
  wsRef: MutableRefObject<WebSocket | null>
  getProposedDimensions: (term: TerminalSession['term'], fitAddon?: TerminalSession['fitAddon']) => { cols: number; rows: number } | undefined
  getResolvedHighlightRules: () => { color: string; pattern: RegExp }[]
  safeFit: (session: TerminalSession) => void
  sendHighlightConfig: (ws: WebSocket) => void
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

export function useTerminalConnection({
  connectionId,
  connectionName,
  resolvedWsUrl,
  showRealtimeInfo,
  tabId,
  wsRef,
  getProposedDimensions,
  getResolvedHighlightRules,
  safeFit,
  sendHighlightConfig,
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

    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer)
      session.reconnectTimer = null
    }
    session.reconnectInputDisposable?.dispose()
    session.reconnectInputDisposable = null

    const ws = new WebSocket(resolvedWsUrl)
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
      sendHighlightConfig(ws)
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

    ws.onmessage = (event) => {
      if (session.ws !== ws) return
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'output': {
          const outputText = String(msg.data ?? '')
          const protectedOutput = shouldPreserveTerminalOutput(outputText)
          let normalizedOutput = outputText
          let shouldRefreshCursor = false
          if (session.awaitingPromptBoundary && !session.lastOutputEndsWithLineBreak) {
            normalizedOutput = normalizeOutputBeforePrompt(normalizedOutput)
          }
          if (session.awaitingPromptBoundary) {
            normalizedOutput = ensureCursorVisibleBeforePrompt(normalizedOutput)
            shouldRefreshCursor = true
          } else if (isLocal && session.awaitingCommandOutputBoundary && protectedOutput) {
            normalizedOutput = normalizeProtectedOutputAfterCommandStart(normalizedOutput)
          }
          if (normalizedOutput) {
            session.awaitingCommandOutputBoundary = false
            session.awaitingPromptBoundary = false
            session.lastOutputEndsWithLineBreak = endsWithExplicitLineBreak(normalizedOutput)
          }
          const settingsNow = useSettingsStore.getState()
          const rendered = settingsNow.termHighlightEnhance
            ? applyAnsiSafeHighlight(normalizedOutput, getResolvedHighlightRules())
            : normalizedOutput
          term.write(rendered, () => {
            if (session.ws !== ws) return
            syncPendingTabCompletionFromTerminal(session)
            if (shouldRefreshCursor) {
              requestAnimationFrame(() => {
                if (session.ws !== ws) return
                term.refresh(0, term.rows - 1)
              })
            }
          })
          if (tabId && useSettingsStore.getState().tabFlashNotify) {
            const tabStore = useTabStore.getState()
            if (tabStore.activeTabId !== tabId) {
              tabStore.setTabActivity(tabId, true)
            }
          }
          break
        }
        case 'shell-integration-status':
          session.shellIntegrationHistory = msg.data?.status === 'ready'
          break
        case 'shell-command-finished': {
          session.shellIntegrationHistory = true
          session.awaitingPromptBoundary = true
          const command = String(msg.data?.command ?? '').trim()
          if (command && useSettingsStore.getState().sshHistoryEnabled && command !== session.lastRecordedCommand && connectionId) {
            session.lastRecordedCommand = command
            addHistory(connectionId, command).catch(() => {})
            const idx = session.historyCache.indexOf(command)
            if (idx !== -1) session.historyCache.splice(idx, 1)
            session.historyCache.unshift(command)
          }
          break
        }
        case 'status':
          if (msg.data === 'connected') {
            hasConnectedRef.current = true
            setConnectionStageText('')
            setPendingHostKeyPrompt(null)
            setConnectionErrorText('')
            updateTerminalStatus('connected')
            requestAnimationFrame(() => {
              if (session.ws !== ws) return
              term.focus()
            })
            startMonitorIfNeeded({ enabled: showRealtimeInfo, isLocal, ws, monitorRunningRef })
            setTimeout(() => {
              safeFit(session)
              const dims = getProposedDimensions(term, fitAddon)
              if (dims && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
              }
            }, 50)
          } else if (msg.data === 'closed') {
            setConnectionStageText('')
            setPendingHostKeyPrompt(null)
            if (!hasConnectedRef.current) {
              setConnectionErrorText(translate('connectionLoading.error.closedBeforeEstablished'))
            } else {
              term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m 连接已关闭')
            }
            updateTerminalStatus('closed')
          } else if (msg.data === 'timeout') {
            setConnectionStageText('')
            setPendingHostKeyPrompt(null)
            if (!hasConnectedRef.current) {
              setConnectionErrorText(translate('connectionLoading.error.timeoutBeforeEstablished'))
            } else {
              term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m 连接超时')
            }
            updateTerminalStatus('closed')
          }
          break
        case 'connection-stage': {
          const data = (msg.data ?? {}) as ConnectionStagePayload
          const stageText = describeConnectionStage(data)
          setConnectionStageText(stageText)
          setConnectionSteps((prev) => nextConnectionSteps(prev, data, stageText))
          break
        }
        case 'ping':
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }))
          }
          break
        case 'hostkey-verification-required': {
          const data = msg.data ?? {}
          const requestId = String(data.requestId ?? '')
          if (!requestId) break
          pendingHostKeyRequestIdRef.current = requestId
          setPendingHostKeyPrompt({
            requestId,
            reason: data.reason === 'mismatch' ? 'mismatch' : 'unknown',
            host: String(data.host ?? ''),
            port: Number(data.port ?? 22),
            username: String(data.username ?? ''),
            keyType: String(data.keyType ?? ''),
            fingerprintSha256: String(data.fingerprintSha256 ?? ''),
            connectionName: typeof data.connectionName === 'string' ? data.connectionName : null,
            knownFingerprintSha256: typeof data.knownFingerprintSha256 === 'string' ? data.knownFingerprintSha256 : null,
            hostRole: data.hostRole === 'jump' || data.hostRole === 'target' ? data.hostRole : null,
            hopIndex: typeof data.hopIndex === 'number' ? data.hopIndex : null,
            hopCount: typeof data.hopCount === 'number' ? data.hopCount : null,
          })
          break
        }
        case 'highlight-config-ack':
          break
        case 'monitor-data':
        case 'monitor-info':
          handleMonitorMessage(msg.type, msg.data, { enabled: showRealtimeInfo, tabId })
          break
        case 'error':
          setConnectionStageText('')
          setPendingHostKeyPrompt(null)
          setConnectionErrorText(String(msg.data ?? translate('connectionLoading.failedTitle')))
          if (hasConnectedRef.current) {
            term.writeln('\r\n\x1b[31m[Vortix 错误]\x1b[0m ' + msg.data)
          }
          updateTerminalStatus('error')
          break
      }
    }

    ws.onclose = () => {
      if (session.ws !== ws) return
      resetMonitorState(monitorRunningRef)
      setConnectionStageText('')
      setPendingHostKeyPrompt(null)
      pendingHostKeyRequestIdRef.current = null
      if (session.isManualDisconnect) return
      if (!hasConnectedRef.current) {
        setConnectionErrorText(translate('connectionLoading.error.websocketClosedBeforeEstablished'))
      } else {
        term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m WebSocket disconnected')
      }
      updateTerminalStatus('closed')

      const maxRetries = settings.autoReconnect ? settings.reconnectCount : 0
      const interval = settings.reconnectInterval * 1000
      if (session.reconnectCount < maxRetries) {
        session.reconnectCount++
        setConnectionStageText(translate('connectionLoading.phase.reconnectingWithCount', { current: session.reconnectCount, total: maxRetries }))
        setConnectionErrorText('')
        updateTerminalStatus('connecting')
        session.reconnectTimer = setTimeout(() => {
          session.reconnectTimer = null
          if (session.ws === ws) connectWsRef.current?.(session, conn)
        }, interval)
      } else {
        setConnectionErrorText(translate('connectionLoading.error.pressAnyKeyReconnect'))
        session.reconnectInputDisposable?.dispose()
        session.reconnectInputDisposable = term.onData(() => {
          session.reconnectInputDisposable?.dispose()
          session.reconnectInputDisposable = null
          session.reconnectCount = 0
          setConnectionStageText(translate('connectionLoading.phase.reconnecting'))
          setConnectionErrorText('')
          updateTerminalStatus('connecting')
          connectWsRef.current?.(session, conn)
        })
      }
    }

    ws.onerror = () => {
      if (session.ws !== ws) return
      setConnectionStageText('')
      setPendingHostKeyPrompt(null)
      pendingHostKeyRequestIdRef.current = null
      setConnectionErrorText(translate('connectionLoading.error.websocketFailed'))
      if (hasConnectedRef.current) {
        term.writeln('\r\n\x1b[31m[Vortix]\x1b[0m WebSocket connection failed. Check whether the backend service is running.')
      }
      updateTerminalStatus('error')
    }
  }, [
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
    sendHighlightConfig,
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
