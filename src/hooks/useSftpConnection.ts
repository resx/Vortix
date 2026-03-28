/* ── SFTP WebSocket 连接生命周期管理 ── */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useSftpStore } from '../stores/useSftpStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { createSftpSessionId, SftpBridgeSocket } from '../lib/sftpBridgeSocket'
import { shouldUseTerminalBridge } from '../lib/terminalBridgeSocket'
import { getReconnectStageText } from '../components/terminal/session/terminal-connection-state'
import type { SftpFileEntry, ExecResult } from '../types/sftp'
import type { SftpSessionId } from '../stores/useSftpStore'
import { useSftpConnectionCore, type ConnectParams, type MessageEventLike, getSftpWsUrl, nextRequestId } from './sftp-connection-core'

type SftpSocketLike = WebSocket | SftpBridgeSocket

export function useSftpConnection(sessionId: SftpSessionId = 'right') {
  const wsRef = useRef<SftpSocketLike | null>(null)
  const pendingRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map())
  const pendingHostKeyRequestIdRef = useRef<string | null>(null)
  const listRequestSeqRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptRef = useRef(0)
  const manualDisconnectRef = useRef(false)
  const lastConnectParamsRef = useRef<ConnectParams | null>(null)
  const store = useSftpStore

  const clearReconnectTimer = useCallback(() => {
    if (!reconnectTimerRef.current) return
    clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
  }, [])

  const {
    clearPendingHostKeyPrompt,
    handleHostKeyVerification,
    request,
    send,
    handleMessage,
    listDir,
  } = useSftpConnectionCore({
    sessionId,
    wsRef,
    pendingRef,
    pendingHostKeyRequestIdRef,
    listRequestSeqRef,
    store,
  })

  const connect = useCallback(async (params: ConnectParams, options?: { force?: boolean }) => {
    const s = store.getState()
    const ss = s.getSessionState(sessionId)
    if ((ss.connected || ss.connecting) && !options?.force) return

    clearReconnectTimer()
    manualDisconnectRef.current = false
    lastConnectParamsRef.current = params
    s.setConnecting(true, sessionId)
    s.setConnected(false, sessionId)
    s.setError(null, sessionId)
    if (!options?.force) s.setReconnectState({ reconnecting: false, reconnectAttempt: 0, reconnectMax: 0, reconnectMessage: null }, sessionId)

    const bridgeSessionKey = shouldUseTerminalBridge() ? createSftpSessionId() : ''
    const ws = bridgeSessionKey ? new SftpBridgeSocket(bridgeSessionKey) : new WebSocket(getSftpWsUrl())
    wsRef.current = ws
    s.setBridgeSessionKey(bridgeSessionKey, sessionId)

    ws.onopen = () => ws.send(JSON.stringify({ type: 'sftp-connect', data: params, requestId: nextRequestId() }))
    ws.onmessage = ((ev: MessageEventLike) => {
      const rawData = ev?.data
      if (typeof rawData !== 'string') return
      let msg: { type: string; data?: unknown }
      try { msg = JSON.parse(rawData) } catch { return }

      if (msg.type === 'hostkey-verification-required') return handleHostKeyVerification((msg.data ?? {}) as Record<string, unknown>)
      if (msg.type === 'sftp-ready') {
        const home = (msg.data as { home: string })?.home || '/'
        const st = store.getState()
        reconnectAttemptRef.current = 0
        st.setConnecting(false, sessionId)
        st.setConnected(true, sessionId)
        st.setReconnectState({ reconnecting: false, reconnectAttempt: 0, reconnectMax: 0, reconnectMessage: null }, sessionId)
        st.setHomePath(home, sessionId)
        st.setConnectionInfo(params.connectionId ?? '', params.connectionName ?? '', sessionId)
        st.navigateTo(home, sessionId)
        ws.onmessage = ((e: MessageEventLike) => handleMessage(e)) as typeof ws.onmessage
        void listDir(home)
        return
      }
      if (msg.type === 'sftp-error') {
        const st = store.getState()
        st.setConnecting(false, sessionId)
        st.setReconnectState({ reconnecting: false, reconnectAttempt: 0, reconnectMax: 0, reconnectMessage: null }, sessionId)
        st.setError((msg.data as { message: string })?.message || '连接失败', sessionId)
      }
    }) as typeof ws.onmessage

    ws.onerror = () => {
      clearPendingHostKeyPrompt()
      const st = store.getState()
      st.setConnecting(false, sessionId)
      st.setReconnectState({ reconnecting: false, reconnectAttempt: 0, reconnectMax: 0, reconnectMessage: null }, sessionId)
      st.setError('WebSocket 连接失败', sessionId)
    }

    ws.onclose = () => {
      clearPendingHostKeyPrompt()
      wsRef.current = null
      const st = store.getState()
      st.setConnected(false, sessionId)
      st.setConnecting(false, sessionId)
      if (manualDisconnectRef.current) return

      const settings = useSettingsStore.getState()
      const maxRetries = settings.autoReconnect ? settings.reconnectCount : 0
      if (reconnectAttemptRef.current >= maxRetries) {
        st.setReconnectState({ reconnecting: false, reconnectAttempt: reconnectAttemptRef.current, reconnectMax: maxRetries, reconnectMessage: null }, sessionId)
        return
      }
      const paramsToReconnect = lastConnectParamsRef.current
      if (!paramsToReconnect) return st.setReconnectState({ reconnecting: false, reconnectAttempt: 0, reconnectMax: maxRetries, reconnectMessage: null }, sessionId)

      reconnectAttemptRef.current += 1
      st.setReconnectState({ reconnecting: true, reconnectAttempt: reconnectAttemptRef.current, reconnectMax: maxRetries, reconnectMessage: getReconnectStageText(reconnectAttemptRef.current, maxRetries) }, sessionId)
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        void connect(paramsToReconnect, { force: true })
      }, Math.max(1, settings.reconnectInterval) * 1000)
    }
  }, [clearPendingHostKeyPrompt, clearReconnectTimer, handleHostKeyVerification, handleMessage, listDir, sessionId, store])

  const mkdir = useCallback(async (path: string) => { await request('sftp-mkdir', { path }) }, [request])
  const rename = useCallback(async (oldPath: string, newPath: string) => { await request('sftp-rename', { oldPath, newPath }) }, [request])
  const remove = useCallback(async (path: string, isDir: boolean) => { await request('sftp-delete', { path, isDir }) }, [request])
  const readFile = useCallback(async (path: string): Promise<string> => (await request<{ path: string; content: string }>('sftp-read-file', { path })).content, [request])
  const writeFile = useCallback(async (path: string, content: string) => { await request('sftp-write-file', { path, content }) }, [request])
  const stat = useCallback(async (path: string) => request<SftpFileEntry>('sftp-stat', { path }), [request])
  const chmod = useCallback(async (path: string, mode: string, recursive = false) => { await request('sftp-chmod', { path, mode, recursive }) }, [request])
  const touch = useCallback(async (path: string, isDir = false) => { await request('sftp-touch', { path, isDir }) }, [request])
  const exec = useCallback(async (command: string): Promise<ExecResult> => request<ExecResult>('sftp-exec', { command }), [request])

  const disconnect = useCallback(() => {
    manualDisconnectRef.current = true
    listRequestSeqRef.current += 1
    clearReconnectTimer()
    reconnectAttemptRef.current = 0
    lastConnectParamsRef.current = null
    store.getState().setReconnectState({ reconnecting: false, reconnectAttempt: 0, reconnectMax: 0, reconnectMessage: null }, sessionId)
    store.getState().setBridgeSessionKey('', sessionId)
    send('sftp-disconnect')
    wsRef.current?.close()
    wsRef.current = null
    store.getState().reset(sessionId)
  }, [clearReconnectTimer, send, sessionId, store])

  const refresh = useCallback(() => {
    listDir(store.getState().getSessionState(sessionId).currentPath)
  }, [listDir, sessionId, store])

  useEffect(() => {
    const pending = pendingRef.current
    return () => {
      manualDisconnectRef.current = true
      clearReconnectTimer()
      clearPendingHostKeyPrompt()
      wsRef.current?.close()
      wsRef.current = null
      store.getState().setBridgeSessionKey('', sessionId)
      pending.clear()
    }
  }, [clearPendingHostKeyPrompt, clearReconnectTimer])

  return useMemo(() => ({
    connect, disconnect, listDir, mkdir, rename, remove, readFile, writeFile, stat, chmod, touch, exec, refresh, send,
  }), [connect, disconnect, listDir, mkdir, rename, remove, readFile, writeFile, stat, chmod, touch, exec, refresh, send])
}
