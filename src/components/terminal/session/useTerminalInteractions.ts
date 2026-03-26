import { useEffect, type MutableRefObject } from 'react'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { useKeywordHighlight } from '../useKeywordHighlight'
import { addInputListener, getSession, removeInputListener } from '../../../stores/terminalSessionRegistry'
import { getHistory } from '../../../api/client'
import { syncMonitorRuntime } from './terminal-monitor'
import {
  clearPendingTabCompletion,
  syncCommandBufferFromTerminalBeforeSubmit,
  syncPendingTabCompletionFromTerminal,
} from './terminal-command-buffer'
import type { Terminal } from '@xterm/xterm'
import type { TerminalSession } from '../../../stores/terminalSessionRegistry'
import type { TerminalConnection } from './terminal-types'

interface UseTerminalInteractionsOptions {
  paneId: string
  profileId?: string | null
  connection: TerminalConnection | null
  connectionId?: string | null
  terminalStatus: 'connecting' | 'connected' | 'closed' | 'error'
  showRealtimeInfo: boolean
  safeFit: (session: TerminalSession) => void
  updateCellHeight: () => void
  wrapperRef: MutableRefObject<HTMLDivElement | null>
  wsRef: MutableRefObject<WebSocket | null>
  termRef: MutableRefObject<Terminal | null>
  monitorRunningRef: MutableRefObject<boolean>
  onContextMenu?: (x: number, y: number, hasSelection: boolean) => void
  onSuggestionKeyDown?: (event: KeyboardEvent) => boolean
}

function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => execCommandCopy(text))
  } else {
    execCommandCopy(text)
  }
}

function execCommandCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;opacity:0;left:-9999px'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

function pasteToSession(paneId: string) {
  navigator.clipboard.readText().then((text) => {
    const current = getSession(paneId)
    if (text && current?.ws?.readyState === WebSocket.OPEN) {
      current.ws.send(JSON.stringify({ type: 'input', data: text }))
    }
  }).catch(() => {})
}

export function useTerminalInteractions({
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
  onSuggestionKeyDown,
}: UseTerminalInteractionsOptions) {
  useEffect(() => {
    const session = getSession(paneId)
    if (!session) return
    const disposable = session.term.onSelectionChange(() => {
      if (!useSettingsStore.getState().termSelectAutoCopy) return
      const selection = getSession(paneId)?.term.getSelection()
      if (selection) navigator.clipboard.writeText(selection).catch(() => {})
    })
    return () => disposable.dispose()
  }, [paneId])

  useEffect(() => {
    const session = getSession(paneId)
    if (!session) return

    session.term.attachCustomKeyEventHandler((event) => {
      if (event.type === 'keydown' && onSuggestionKeyDown?.(event)) {
        return false
      }
      if (event.key === 'F12' && useSettingsStore.getState().debugMode) return false
      if (event.key === 'Tab' && event.type === 'keydown') {
        // Keep browser focus traversal from stealing Tab while the terminal owns keyboard focus.
        event.preventDefault()
        return true
      }
      if (event.ctrlKey && event.shiftKey && (event.key === 'C' || event.key === 'c' || event.key === 'V' || event.key === 'v') && event.type === 'keydown') {
        return false
      }
      const { termCtrlVPaste } = useSettingsStore.getState()
      if (termCtrlVPaste && event.ctrlKey && !event.shiftKey && event.key === 'v' && event.type === 'keydown') {
        return false
      }
      return true
    })
  }, [onSuggestionKeyDown, paneId])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && (event.key === 'C' || event.key === 'c')) {
        event.preventDefault()
        event.stopPropagation()
        const selection = getSession(paneId)?.term.getSelection()
        if (selection) copyText(selection)
        return
      }
      if (event.ctrlKey && event.shiftKey && (event.key === 'V' || event.key === 'v')) {
        event.preventDefault()
        event.stopPropagation()
        pasteToSession(paneId)
        return
      }
      if (event.ctrlKey && !event.shiftKey && (event.key === 'v' || event.key === 'V')) {
        if (useSettingsStore.getState().termCtrlVPaste) {
          event.preventDefault()
          event.stopPropagation()
          pasteToSession(paneId)
        }
      }
    }
    wrapper.addEventListener('keydown', handler, true)
    return () => wrapper.removeEventListener('keydown', handler, true)
  }, [paneId, wrapperRef])

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const handler = (event: MouseEvent) => {
      if (event.button !== 1) return
      const action = useSettingsStore.getState().termMiddleClickAction
      if (action === 'none') return
      event.preventDefault()

      if (action === 'copy') {
        const selection = getSession(paneId)?.term.getSelection()
        if (selection) navigator.clipboard.writeText(selection).catch(() => {})
        return
      }
      if (action === 'paste') {
        pasteToSession(paneId)
        return
      }
      if (action === 'menu') {
        const hasSelection = !!getSession(paneId)?.term.getSelection()
        onContextMenu?.(event.clientX, event.clientY, hasSelection)
        return
      }

      const session = getSession(paneId)
      const selection = session?.term.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {})
      } else {
        pasteToSession(paneId)
      }
    }

    wrapper.addEventListener('mousedown', handler)
    return () => wrapper.removeEventListener('mousedown', handler)
  }, [onContextMenu, paneId, wrapperRef])

  useKeywordHighlight({ termRef, profileId })

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handler = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      event.stopPropagation()
      if (!useSettingsStore.getState().termZoomEnabled) return
      const session = getSession(paneId)
      if (!session) return
      const current = session.term.options.fontSize ?? 14
      const next = event.deltaY < 0 ? Math.min(40, current + 1) : Math.max(8, current - 1)
      if (next !== current) {
        session.term.options.fontSize = next
        safeFit(session)
        setTimeout(updateCellHeight, 0)
      }
    }
    wrapper.addEventListener('wheel', handler, { passive: false })
    return () => wrapper.removeEventListener('wheel', handler)
  }, [paneId, safeFit, updateCellHeight, wrapperRef])

  useEffect(() => {
    if (!connection || ('type' in connection && connection.type === 'local')) return
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN || terminalStatus !== 'connected') return
    syncMonitorRuntime({ enabled: showRealtimeInfo, isLocal: false, ws, monitorRunningRef })
  }, [connection, monitorRunningRef, showRealtimeInfo, terminalStatus, wsRef])

  useEffect(() => {
    if (!connectionId) return

    const listener = (data: string) => {
      const session = getSession(paneId)
      if (!session) return

      if (data === '\r') {
        syncCommandBufferFromTerminalBeforeSubmit(session)
        const command = session.commandBuffer.trim()
        if (!session.shellIntegrationHistory && command && useSettingsStore.getState().sshHistoryEnabled && command !== session.lastRecordedCommand) {
          session.lastRecordedCommand = command
          const idx = session.historyCache.indexOf(command)
          if (idx !== -1) session.historyCache.splice(idx, 1)
          session.historyCache.unshift(command)
        }
        session.commandBuffer = ''
        clearPendingTabCompletion(session)
      } else if (data === '\t') {
        session.pendingTabCompletion = true
        session.pendingTabCompletionBuffer = session.commandBuffer
      } else if (data === '\x7f' || data === '\b') {
        syncPendingTabCompletionFromTerminal(session)
        clearPendingTabCompletion(session)
        session.commandBuffer = session.commandBuffer.slice(0, -1)
      } else if (data === '\x03' || data === '\x04') {
        session.commandBuffer = ''
        clearPendingTabCompletion(session)
      } else if (data.startsWith('\x1b')) {
        syncPendingTabCompletionFromTerminal(session)
        session.commandBuffer = ''
        clearPendingTabCompletion(session)
      } else {
        syncPendingTabCompletionFromTerminal(session)
        clearPendingTabCompletion(session)
        session.commandBuffer += data
      }
    }

    addInputListener(paneId, listener)
    return () => removeInputListener(paneId, listener)
  }, [connectionId, paneId])

  useEffect(() => {
    if (!connectionId) return
    const loadCount = useSettingsStore.getState().sshHistoryLoadCount || 100
    getHistory(connectionId, loadCount)
      .then((history) => {
        const session = getSession(paneId)
        if (session) session.historyCache = history.map((item) => item.command)
      })
      .catch(() => {})
  }, [connectionId, paneId])

}
