import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import {
  DEFAULT_TERMINAL_HIGHLIGHT_RULES,
  normalizeTerminalHighlightRules,
  useSettingsStore,
} from '../../stores/useSettingsStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { getSession } from '../../stores/terminalSessionRegistry'
import { getWsBaseUrl } from '../../api/client'
import { t as translate } from '../../i18n'
import { resolveFontChain } from '../../lib/fonts'
import ConnectionLoadingView, { type ConnectionLoadingStep } from './ConnectionLoadingView'
import {
  fitTerminalSession,
  getProposedTerminalDimensions,
  readTerminalCellHeight,
  stabilizeTerminalSessionLayout,
} from './session/terminal-layout'
import { buildConnectionRouteLabel } from './session/terminal-connection-state'
import { compileResolvedTerminalHighlightRules, resolveThemeHighlightPalette } from '../../lib/terminal-highlight/resolver'
import { resetMonitorState } from './session/terminal-monitor'
import { useTerminalConnection } from './session/useTerminalConnection'
import { useTerminalInteractions } from './session/useTerminalInteractions'
import { useTerminalMount, useTerminalProfileSync } from './session/useTerminalMount'
import TerminalSuggestionOverlay from './suggestions/TerminalSuggestionOverlay'
import { useTerminalSuggestions } from './suggestions/useTerminalSuggestions'
import type { TerminalSession } from '../../stores/terminalSessionRegistry'
import type { HostKeyVerificationPayload, SshTerminalProps } from './session/terminal-types'
import '@xterm/xterm/css/xterm.css'

export type { TerminalConnection } from './session/terminal-types'

export default function SshTerminal({
  paneId,
  tabId,
  wsUrl,
  connection,
  connectionId,
  connectionName,
  profileId,
  onStatusChange,
  onContextMenu,
}: SshTerminalProps) {
  const resolvedWsUrl = wsUrl || `${getWsBaseUrl()}/ws/ssh`
  const wrapperRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const connectWsRef = useRef<((session: TerminalSession, conn: NonNullable<SshTerminalProps['connection']>) => void) | null>(null)
  const pendingHostKeyRequestIdRef = useRef<string | null>(null)
  const hasConnectedRef = useRef(false)
  const monitorRunningRef = useRef(false)
  const onStatusChangeRef = useRef(onStatusChange)

  const [cellHeight, setCellHeight] = useState(0)
  const [terminalStatus, setTerminalStatus] = useState<'connecting' | 'connected' | 'closed' | 'error'>('connecting')
  const [connectionStageText, setConnectionStageText] = useState('')
  const [connectionSteps, setConnectionSteps] = useState<ConnectionLoadingStep[]>([])
  const [pendingHostKeyPrompt, setPendingHostKeyPrompt] = useState<HostKeyVerificationPayload | null>(null)
  const [connectionErrorText, setConnectionErrorText] = useState('')

  const runtimeThemeMode = useThemeStore((state) => state.runtimeMode)
  const showRealtimeInfo = useSettingsStore((state) => state.showRealtimeInfo)
  const termSuggestionMode = useSettingsStore((state) => state.termSuggestionMode)
  const termSuggestionSources = useSettingsStore((state) => state.termSuggestionSources)
  const termFontFamily = useSettingsStore((state) => state.termFontFamily)
  const termFontSize = useSettingsStore((state) => state.termFontSize)
  const termStripeEnabled = useSettingsStore((state) => state.termStripeEnabled)
  const fallbackStripeHeight = useSettingsStore((state) => Math.max(1, Math.round((state.termFontSize || 14) * (state.termLineHeight || 1))))

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    hasConnectedRef.current = false
    resetMonitorState(monitorRunningRef)
    setTerminalStatus('connecting')
    setConnectionStageText('')
    setConnectionSteps([])
    setPendingHostKeyPrompt(null)
    setConnectionErrorText('')
  }, [connection])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const session = getSession(paneId)
    if (!session) return
    session.connectionStageText = connectionStageText
    session.connectionSteps = connectionSteps
    session.connectionErrorText = connectionErrorText
  }, [connectionErrorText, connectionStageText, connectionSteps, paneId])

  const getProposedDimensions = useCallback((term: Terminal, fitAddon?: FitAddon) => {
    return getProposedTerminalDimensions(wrapperRef.current, term, fitAddon)
  }, [])

  const safeFit = useCallback((session: TerminalSession) => {
    fitTerminalSession(wrapperRef.current, session)
  }, [])

  const updateCellHeight = useCallback(() => {
    const session = getSession(paneId)
    if (!session) return
    const height = readTerminalCellHeight(session.term)
    if (height > 0) setCellHeight(height)
  }, [paneId])

  const stabilizeTerminalLayout = useCallback((session: TerminalSession, preferredFont?: string) => {
    stabilizeTerminalSessionLayout(wrapperRef.current, session, {
      preferredFont,
      onLayoutApplied: updateCellHeight,
    })
  }, [updateCellHeight])

  const applyPerformanceMode = useCallback((session: TerminalSession, enabled: boolean) => {
    if (enabled) {
      if (session.webglAddon) return
      try {
        const addon = new WebglAddon()
        addon.onContextLoss(() => {
          if (session.webglAddon === addon) {
            session.webglAddon = null
          }
          addon.dispose()
          requestAnimationFrame(() => session.term.refresh(0, session.term.rows - 1))
        })
        session.term.loadAddon(addon)
        session.webglAddon = addon
        session.term.refresh(0, session.term.rows - 1)
      } catch {
        session.webglAddon = null
      }
      return
    }

    if (session.webglAddon) {
      session.webglAddon.dispose()
      session.webglAddon = null
      session.term.refresh(0, session.term.rows - 1)
    }
  }, [])

  const getResolvedHighlightRules = useCallback(() => {
    const settings = useSettingsStore.getState()
    if (!settings.termHighlightEnhance) return []
    const mergedRules = normalizeTerminalHighlightRules([
      ...DEFAULT_TERMINAL_HIGHLIGHT_RULES,
      ...(settings.termHighlightRules ?? []),
    ])
    const themeStore = useThemeStore.getState()
    const activeThemeId = runtimeThemeMode === 'dark' ? settings.termThemeDark : settings.termThemeLight
    const themeHighlights = resolveThemeHighlightPalette(themeStore.getThemeById(activeThemeId)?.highlights)
    return compileResolvedTerminalHighlightRules(mergedRules, themeHighlights)
  }, [runtimeThemeMode])

  const updateTerminalStatus = useCallback((status: 'connecting' | 'connected' | 'closed' | 'error') => {
    setTerminalStatus(status)
    const session = getSession(paneId)
    if (session) session.connectionStatus = status
    onStatusChangeRef.current?.(status)
  }, [paneId])

  const connectWs = useTerminalConnection({
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
  })

  useEffect(() => {
    connectWsRef.current = connectWs
  }, [connectWs])

  const handleRetryConnection = useCallback(() => {
    if (!connection) return
    const session = getSession(paneId)
    if (!session) return
    hasConnectedRef.current = false
    pendingHostKeyRequestIdRef.current = null
    setPendingHostKeyPrompt(null)
    setConnectionStageText('')
    setConnectionSteps([])
    setConnectionErrorText('')
    updateTerminalStatus('connecting')
    connectWsRef.current?.(session, connection)
    session.term.focus()
  }, [connection, paneId, updateTerminalStatus])

  useTerminalMount({
    paneId,
    profileId,
    connection,
    wrapperRef,
    termRef,
    fitAddonRef,
    wsRef,
    hasConnectedRef,
    connectWs,
    applyPerformanceMode,
    getProposedDimensions,
    safeFit,
    stabilizeTerminalLayout,
    updateCellHeight,
    updateTerminalStatus,
    setConnectionStageText,
    setConnectionSteps,
    setPendingHostKeyPrompt,
    setConnectionErrorText,
  })

  useTerminalProfileSync({
    paneId,
    profileId,
    applyPerformanceMode,
    stabilizeTerminalLayout,
    safeFit,
    updateCellHeight,
  })

  const {
    visible: suggestionVisible,
    candidates: suggestionCandidates,
    activeIndex: suggestionActiveIndex,
    cursorCoords,
    handleKeyDown: handleSuggestionKeyDown,
    selectIndex: selectSuggestionIndex,
    acceptIndex: acceptSuggestionIndex,
  } = useTerminalSuggestions({
    paneId,
    enabled: termSuggestionMode !== 'off',
    matchMode: termSuggestionMode === 'off' ? 'smart' : termSuggestionMode,
    enabledSources: termSuggestionSources,
    connectionKind: connection && 'type' in connection && connection.type === 'local' ? 'local' : 'ssh',
    platformProfile: 'unknown',
    limit: 12,
  })

  useTerminalInteractions({
    paneId,
    profileId,
    connection,
    connectionId,
    terminalStatus,
    showRealtimeInfo,
    safeFit,
    updateCellHeight,
    wrapperRef,
    wsRef,
    termRef,
    monitorRunningRef,
    onContextMenu,
    onSuggestionKeyDown: handleSuggestionKeyDown,
  })

  const stripeHeight = cellHeight > 0 ? cellHeight : fallbackStripeHeight
  const suggestionFontFamily = resolveFontChain(termFontFamily, 'monospace')
  const suggestionFontSize = Math.max(10, termFontSize || 14)
  const stripeBackgroundImage = termStripeEnabled
    ? `repeating-linear-gradient(to bottom,
      transparent 0px, transparent ${stripeHeight}px,
      ${runtimeThemeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)'} ${stripeHeight}px,
      ${runtimeThemeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)'} ${stripeHeight * 2}px)`
    : undefined
  const connectionRouteLabel = buildConnectionRouteLabel(connection)
  const connectionLoadingSteps = connectionSteps.length > 0
    ? connectionSteps
    : connectionStageText
      ? [{ id: 'current-stage', label: connectionStageText, status: connectionErrorText ? 'error' as const : 'active' as const }]
      : []
  const showConnectionLoadingView = Boolean(connection) && (
    terminalStatus !== 'connected' || Boolean(pendingHostKeyPrompt) || Boolean(connectionErrorText)
  )

  const handleHostKeyDecision = useCallback((decision: 'trust' | 'replace' | 'reject') => {
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
  }, [])

  const handleContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const action = useSettingsStore.getState().termRightClickAction
    if (action === 'none') return

    const session = getSession(paneId)
    const selection = session?.term.getSelection()
    const paste = () => {
      navigator.clipboard.readText().then((text) => {
        const current = getSession(paneId)
        if (text && current?.ws?.readyState === WebSocket.OPEN) {
          current.ws.send(JSON.stringify({ type: 'input', data: text }))
        }
      }).catch(() => {})
    }

    if (action === 'copy') {
      if (selection) navigator.clipboard.writeText(selection).catch(() => {})
      return
    }
    if (action === 'paste') {
      paste()
      return
    }
    if (action === 'copy-paste') {
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {})
      } else {
        paste()
      }
      return
    }

    onContextMenu?.(event.clientX, event.clientY, !!selection)
  }, [onContextMenu, paneId])

  return (
    <div className="w-full h-full relative">
      <div
        ref={wrapperRef}
        className="w-full h-full terminal-container transition-colors duration-300"
        onContextMenu={handleContextMenu}
      />
      {showConnectionLoadingView && (
        <ConnectionLoadingView
          title={connectionStageText || translate('connectionLoading.preparing')}
          subtitle={connectionRouteLabel}
          steps={connectionLoadingSteps}
          error={connectionErrorText || null}
          hostKeyPrompt={pendingHostKeyPrompt}
          onHostKeyDecision={handleHostKeyDecision}
          onRetry={connectionErrorText ? handleRetryConnection : null}
        />
      )}
      {stripeBackgroundImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: stripeBackgroundImage }}
        />
      )}
      <TerminalSuggestionOverlay
        visible={suggestionVisible && !!cursorCoords}
        candidates={suggestionCandidates}
        activeIndex={suggestionActiveIndex}
        fontFamily={suggestionFontFamily}
        fontSize={suggestionFontSize}
        anchorX={cursorCoords?.x ?? 0}
        anchorY={cursorCoords?.y ?? 0}
        cellHeight={cursorCoords?.cellHeight ?? stripeHeight}
        onSelect={selectSuggestionIndex}
        onAccept={acceptSuggestionIndex}
      />
    </div>
  )
}
