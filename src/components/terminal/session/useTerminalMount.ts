import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../../stores/useThemeStore'
import { getSession, notifyInputListeners, setSession } from '../../../stores/terminalSessionRegistry'
import { t as translate } from '../../../i18n'
import { playBellSound } from './terminal-output'
import { syncPendingTabCompletionFromTerminal } from './terminal-command-buffer'
import type { ConnectionLoadingStep } from '../ConnectionLoadingView'
import type { TerminalSession } from '../../../stores/terminalSessionRegistry'
import type { TerminalSocketLike } from '../../../stores/terminalSessionRegistry'
import type { HostKeyVerificationPayload, SshConnection, TerminalConnection } from './terminal-types'

interface UseTerminalMountOptions {
  paneId: string
  profileId?: string | null
  connection: TerminalConnection | null
  wrapperRef: MutableRefObject<HTMLDivElement | null>
  termRef: MutableRefObject<Terminal | null>
  fitAddonRef: MutableRefObject<FitAddon | null>
  wsRef: MutableRefObject<TerminalSocketLike | null>
  hasConnectedRef: MutableRefObject<boolean>
  connectWs: (session: TerminalSession, connection: NonNullable<TerminalConnection>) => void
  applyPerformanceMode: (session: TerminalSession, enabled: boolean) => void
  getProposedDimensions: (term: Terminal, fitAddon?: FitAddon) => { cols: number; rows: number } | undefined
  safeFit: (session: TerminalSession) => void
  stabilizeTerminalLayout: (session: TerminalSession, preferredFont?: string) => void
  updateCellHeight: () => void
  updateTerminalStatus: (status: 'connecting' | 'connected' | 'closed' | 'error') => void
  setConnectionStageText: Dispatch<SetStateAction<string>>
  setConnectionSteps: Dispatch<SetStateAction<ConnectionLoadingStep[]>>
  setPendingHostKeyPrompt: Dispatch<SetStateAction<HostKeyVerificationPayload | null>>
  setConnectionErrorText: Dispatch<SetStateAction<string>>
}

export function useTerminalMount({
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
}: UseTerminalMountOptions) {
  useEffect(() => {
    if (!wrapperRef.current || !connection) return
    const wrapper = wrapperRef.current

    const existing = getSession(paneId)
    if (existing) {
      wrapper.appendChild(existing.containerEl)
      if (!existing.isOpened) {
        existing.term.open(existing.containerEl)
        existing.isOpened = true
      }
      termRef.current = existing.term
      fitAddonRef.current = existing.fitAddon
      wsRef.current = existing.ws
      hasConnectedRef.current = existing.connectionStatus === 'connected'
      updateTerminalStatus(existing.connectionStatus)
      setConnectionStageText(existing.connectionStageText ?? '')
      setConnectionSteps(existing.connectionSteps ?? [])
      setPendingHostKeyPrompt(null)
      setConnectionErrorText(existing.connectionErrorText ?? '')
      applyPerformanceMode(existing, useSettingsStore.getState().termHighPerformance)

      setTimeout(() => {
        const session = getSession(paneId)
        if (!session) return
        session.term.refresh(0, session.term.rows - 1)
        safeFit(session)
        const dims = getProposedDimensions(session.term, session.fitAddon)
        if (dims && session.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
        }
        updateCellHeight()
        stabilizeTerminalLayout(session)
      }, 100)
    } else {
      const settings = useSettingsStore.getState()
      const isDark = useThemeStore.getState().runtimeMode === 'dark'
      const resolved = useTerminalProfileStore.getState()
        .resolveProfile(profileId ?? settings.activeProfileId, isDark)

      const term = new Terminal({
        cursorBlink: resolved.profile.cursorBlink,
        cursorStyle: resolved.profile.cursorStyle,
        fontSize: resolved.profile.fontSize,
        fontFamily: resolved.fontFamily,
        lineHeight: resolved.profile.lineHeight || 1.6,
        letterSpacing: resolved.profile.letterSpacing || 0,
        theme: resolved.theme,
        scrollback: resolved.profile.scrollback || 1000,
        allowProposedApi: true,
      })
      ;(term.options as typeof term.options & { fontLigatures?: boolean }).fontLigatures = settings.fontLigatures

      const fitAddon = new FitAddon()
      const searchAddon = new SearchAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(searchAddon)
      term.loadAddon(new WebLinksAddon((event, uri) => {
        if (event.ctrlKey || event.metaKey) {
          window.open(uri, '_blank', 'noopener')
        }
      }, {
        hover: (_event, uri) => {
          const isMac = navigator.platform.toUpperCase().includes('MAC')
          const modifier = isMac ? 'Cmd' : 'Ctrl'
          term.element?.setAttribute('title', `${modifier}+Click 打开链接: ${uri}`)
        },
        leave: () => {
          term.element?.removeAttribute('title')
        },
      }))

      const containerEl = document.createElement('div')
      containerEl.style.width = '100%'
      containerEl.style.height = '100%'
      wrapper.appendChild(containerEl)

      const session: TerminalSession = {
        containerEl,
        term,
        fitAddon,
        searchAddon,
        webglAddon: null,
        isOpened: false,
        ws: null,
        reconnectTimer: null,
        reconnectCount: 0,
        connectionStatus: 'connecting',
        isManualDisconnect: false,
        inputDisposable: null,
        reconnectInputDisposable: null,
        commandBuffer: '',
        historyCache: [],
        lastRecordedCommand: '',
        shellIntegrationHistory: false,
        pendingTabCompletion: false,
        pendingTabCompletionBuffer: '',
        connectionStageText: '',
        connectionSteps: [],
        connectionErrorText: '',
        awaitingCommandOutputBoundary: false,
        awaitingPromptBoundary: false,
        lastOutputEndsWithLineBreak: true,
        inFullscreenEditor: false,
      }
      setSession(paneId, session)

      termRef.current = term
      fitAddonRef.current = fitAddon

      term.onResize(({ cols, rows }) => {
        const current = getSession(paneId)
        if (current?.ws?.readyState === WebSocket.OPEN) {
          current.ws.send(JSON.stringify({ type: 'resize', data: { cols, rows } }))
        }
      })
      term.onWriteParsed(() => {
        const current = getSession(paneId)
        if (!current?.pendingTabCompletion) return
        syncPendingTabCompletionFromTerminal(current)
      })
      session.inputDisposable = term.onData((data) => {
        const current = getSession(paneId)
        if (current?.ws?.readyState === WebSocket.OPEN) {
          current.ws.send(JSON.stringify({ type: 'input', data }))
        }
        if (current) {
          if (data === '\r') current.awaitingCommandOutputBoundary = true
          else if (current.awaitingCommandOutputBoundary) current.awaitingCommandOutputBoundary = false
        }
        notifyInputListeners(paneId, data)
      })
      term.onBell(() => {
        if (useSettingsStore.getState().termSound) playBellSound()
      })

      const isLocalConn = 'type' in connection && connection.type === 'local'
      setConnectionStageText(
        isLocalConn
          ? `${translate('connectionLoading.phase.startingLocal')} ${connection.shell}...`
          : `${translate('connectionLoading.phase.connecting')} ${(connection as SshConnection).host}:${(connection as SshConnection).port} ...`,
      )
      updateTerminalStatus('connecting')
      const preferredFont = resolved.fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '')
      const fontSize = resolved.profile.fontSize ?? 14

      const waitForTerminalReady = async () => {
        if (document.fonts?.ready) {
          await Promise.race([
            document.fonts.ready,
            new Promise<void>((resolve) => window.setTimeout(resolve, 500)),
          ]).catch(() => {})
        }
        if (preferredFont && document.fonts?.load) {
          await Promise.race([
            document.fonts.load(`${fontSize}px "${preferredFont}"`),
            new Promise<FontFace[]>((resolve) => window.setTimeout(() => resolve([]), 500)),
          ]).catch(() => {})
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }

      void waitForTerminalReady().then(() => {
        if (!session.isOpened) {
          term.open(containerEl)
          session.isOpened = true
        }
        applyPerformanceMode(session, settings.termHighPerformance)
        stabilizeTerminalLayout(session, preferredFont)
        connectWs(session, connection)
        updateCellHeight()
      })
    }

    let resizeRafId = 0
    const handleResize = () => {
      cancelAnimationFrame(resizeRafId)
      resizeRafId = requestAnimationFrame(() => {
        const session = getSession(paneId)
        if (!session) return
        const container = wrapperRef.current
        if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return
        safeFit(session)
        const dims = getProposedDimensions(session.term, session.fitAddon)
        if (dims && session.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
        }
      })
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(wrapper)

    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const session = getSession(paneId)
          if (!session) return
          stabilizeTerminalLayout(session)
        }
      }
    })
    intersectionObserver.observe(wrapper)

    return () => {
      cancelAnimationFrame(resizeRafId)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      const session = getSession(paneId)
      if (session && wrapper.contains(session.containerEl)) {
        wrapper.removeChild(session.containerEl)
      }
      termRef.current = null
      fitAddonRef.current = null
      wsRef.current = null
    }
  }, [
    applyPerformanceMode,
    connectWs,
    connection,
    getProposedDimensions,
    hasConnectedRef,
    paneId,
    profileId,
    safeFit,
    setConnectionErrorText,
    setConnectionStageText,
    setConnectionSteps,
    setPendingHostKeyPrompt,
    stabilizeTerminalLayout,
    termRef,
    updateCellHeight,
    updateTerminalStatus,
    wrapperRef,
    fitAddonRef,
    wsRef,
  ])
}
export { useTerminalProfileSync } from './useTerminalProfileSync'
