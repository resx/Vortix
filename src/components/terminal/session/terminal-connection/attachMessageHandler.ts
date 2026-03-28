import { addHistory } from '../../../../api/client'
import { t as translate } from '../../../../i18n'
import { useSettingsStore } from '../../../../stores/useSettingsStore'
import { useTabStore } from '../../../../stores/useTabStore'
import type { TerminalSession } from '../../../../stores/terminalSessionRegistry'
import { clearPendingTabCompletion, syncPendingTabCompletionFromTerminal } from '../terminal-command-buffer'
import { describeConnectionStage, nextConnectionSteps } from '../terminal-connection-state'
import { resolveFullscreenEditorModeFromOutput } from '../terminal-editor-mode'
import { handleMonitorMessage, startMonitorIfNeeded } from '../terminal-monitor'
import {
  applyIncrementalAnsiSafeHighlight,
  endsWithExplicitLineBreak,
  ensureCursorVisibleBeforePrompt,
  normalizeOutputBeforePrompt,
  normalizeProtectedOutputAfterCommandStart,
  shouldPreserveTerminalOutput,
} from '../terminal-output'
import type { ConnectionStagePayload, SshConnection } from '../terminal-types'
import type { TerminalConnectionSocket, UseTerminalConnectionOptions, WriteInlineFn } from './types'

interface AttachMessageHandlerOptions {
  ws: TerminalConnectionSocket
  session: TerminalSession
  fitAddon: TerminalSession['fitAddon']
  isLocal: boolean
  sshConn: SshConnection | null
  connectionId?: string | null
  showRealtimeInfo: boolean
  tabId?: string
  lastInlineStageTextRef: { current: string }
  writeInline: WriteInlineFn
  monitorRunningRef: UseTerminalConnectionOptions['monitorRunningRef']
  hasConnectedRef: UseTerminalConnectionOptions['hasConnectedRef']
  pendingHostKeyRequestIdRef: UseTerminalConnectionOptions['pendingHostKeyRequestIdRef']
  setConnectionStageText: UseTerminalConnectionOptions['setConnectionStageText']
  setConnectionSteps: UseTerminalConnectionOptions['setConnectionSteps']
  setPendingHostKeyPrompt: UseTerminalConnectionOptions['setPendingHostKeyPrompt']
  setConnectionErrorText: UseTerminalConnectionOptions['setConnectionErrorText']
  updateTerminalStatus: UseTerminalConnectionOptions['updateTerminalStatus']
  safeFit: UseTerminalConnectionOptions['safeFit']
  getProposedDimensions: UseTerminalConnectionOptions['getProposedDimensions']
  getResolvedHighlightRules: UseTerminalConnectionOptions['getResolvedHighlightRules']
}

export function attachMessageHandler({
  ws,
  session,
  fitAddon,
  isLocal,
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
}: AttachMessageHandlerOptions) {
  const { term } = session

  ws.onmessage = (event: { data: string }) => {
    if (session.ws !== ws) return
    const msg = JSON.parse(event.data)

    switch (msg.type) {
      case 'output': {
        const outputText = String(msg.data ?? '')
        const prevEditorMode = session.inFullscreenEditor
        const nextEditorMode = resolveFullscreenEditorModeFromOutput(outputText, prevEditorMode)
        if (nextEditorMode !== prevEditorMode) {
          session.inFullscreenEditor = nextEditorMode
          if (nextEditorMode) {
            session.commandBuffer = ''
            clearPendingTabCompletion(session)
          }
        }
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
        let rendered = normalizedOutput
        if (settingsNow.termHighlightEnhance) {
          const result = applyIncrementalAnsiSafeHighlight(
            normalizedOutput,
            getResolvedHighlightRules(),
            session.highlightLineTail,
          )
          rendered = result.renderedText
          session.highlightLineTail = result.nextTail
        } else {
          session.highlightLineTail = ''
        }
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
          session.highlightLineTail = ''
          term.clear()
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
            writeInline(translate('connectionLoading.error.closedBeforeEstablished'), 'warn')
          } else {
            session.highlightLineTail = ''
            term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m 连接已关闭')
          }
          updateTerminalStatus('closed')
        } else if (msg.data === 'timeout') {
          setConnectionStageText('')
          setPendingHostKeyPrompt(null)
          if (!hasConnectedRef.current) {
            setConnectionErrorText(translate('connectionLoading.error.timeoutBeforeEstablished'))
            writeInline(translate('connectionLoading.error.timeoutBeforeEstablished'), 'warn')
          } else {
            session.highlightLineTail = ''
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
        if (stageText && stageText !== lastInlineStageTextRef.current) {
          lastInlineStageTextRef.current = stageText
          writeInline(stageText)
        }
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
      case 'monitor-data':
      case 'monitor-info':
        handleMonitorMessage(msg.type, msg.data, { enabled: showRealtimeInfo, tabId })
        break
      case 'error':
        setConnectionStageText('')
        setPendingHostKeyPrompt(null)
        setConnectionErrorText(String(msg.data ?? translate('connectionLoading.failedTitle')))
        writeInline(String(msg.data ?? translate('connectionLoading.failedTitle')), 'error')
        if (hasConnectedRef.current) {
          session.highlightLineTail = ''
          term.writeln(`\r\n\x1b[31m[Vortix 错误]\x1b[0m ${msg.data}`)
        }
        updateTerminalStatus('error')
        break
    }
  }
}
