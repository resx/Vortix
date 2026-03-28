import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'
import { handleDownloadChunk, handleDownloadComplete, handleDownloadError } from '../services/transfer-engine'
import { getWsBaseUrl } from '../api/client'
import type { SftpFileEntry, SftpDirSizeData } from '../types/sftp'
import { closeHostKeyPrompt, promptHostKeyTrust } from '../utils/hostKeyPrompt'
import type { SftpSessionId } from '../stores/useSftpStore'

export interface ConnectParams {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  connectionId?: string
  connectionName?: string
  jump?: {
    connectionId?: string
    connectionName?: string
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
    passphrase?: string
  }
}

export type MessageEventLike = MessageEvent<unknown> | { data?: unknown }
export interface SocketLike {
  readyState: number
  send: (data: string) => void
}

let requestCounter = 0
export function nextRequestId(): string {
  return `sftp-${++requestCounter}-${Date.now()}`
}

export function getSftpWsUrl(): string {
  return `${getWsBaseUrl()}/ws/sftp`
}

interface UseSftpConnectionCoreParams {
  sessionId: SftpSessionId
  wsRef: MutableRefObject<SocketLike | null>
  pendingRef: MutableRefObject<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>
  pendingHostKeyRequestIdRef: MutableRefObject<string | null>
  listRequestSeqRef: MutableRefObject<number>
  store: {
    getState: () => {
      updateEntrySize: (path: string, size: number, sid: SftpSessionId) => void
      setError: (error: string | null, sid: SftpSessionId) => void
      setLoading: (loading: boolean, sid: SftpSessionId) => void
      setEntries: (entries: SftpFileEntry[], sid: SftpSessionId) => void
      getSessionState: (sid: SftpSessionId) => { currentPath: string }
    }
  }
}

export function useSftpConnectionCore({
  sessionId,
  wsRef,
  pendingRef,
  pendingHostKeyRequestIdRef,
  listRequestSeqRef,
  store,
}: UseSftpConnectionCoreParams) {
  const clearPendingHostKeyPrompt = useCallback(() => {
    closeHostKeyPrompt(pendingHostKeyRequestIdRef.current)
    pendingHostKeyRequestIdRef.current = null
  }, [pendingHostKeyRequestIdRef])

  const handleHostKeyVerification = useCallback((data: Record<string, unknown>) => {
    const requestId = String(data.requestId ?? '')
    if (!requestId) return
    pendingHostKeyRequestIdRef.current = requestId
    void promptHostKeyTrust({
      requestId,
      reason: data.reason === 'mismatch' ? 'mismatch' : 'unknown',
      host: String(data.host ?? ''),
      port: Number(data.port ?? 22),
      username: String(data.username ?? ''),
      keyType: String(data.keyType ?? ''),
      fingerprintSha256: String(data.fingerprintSha256 ?? ''),
      connectionId: typeof data.connectionId === 'string' ? data.connectionId : null,
      connectionName: typeof data.connectionName === 'string' ? data.connectionName : null,
      knownKeyType: typeof data.knownKeyType === 'string' ? data.knownKeyType : null,
      knownFingerprintSha256: typeof data.knownFingerprintSha256 === 'string' ? data.knownFingerprintSha256 : null,
    }).then((decision) => {
      pendingHostKeyRequestIdRef.current = null
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(JSON.stringify({ type: 'hostkey-verification-decision', data: { requestId, trust: decision !== 'reject', replaceExisting: decision === 'replace' } }))
    })
  }, [pendingHostKeyRequestIdRef, wsRef])

  const request = useCallback(<T = unknown>(type: string, data?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return reject(new Error('SFTP 未连接'))
      const requestId = nextRequestId()
      pendingRef.current.set(requestId, { resolve: resolve as (v: unknown) => void, reject })
      ws.send(JSON.stringify({ type, data, requestId }))
      const timeoutMs = (useSettingsStore.getState().sftpListTimeout || 60) * 1000
      setTimeout(() => {
        if (!pendingRef.current.has(requestId)) return
        pendingRef.current.delete(requestId)
        reject(new Error('请求超时'))
      }, timeoutMs)
    })
  }, [pendingRef, wsRef])

  const send = useCallback((type: string, data?: unknown) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type, data }))
  }, [wsRef])

  const handleMessage = useCallback((ev: MessageEventLike) => {
    const rawData = ev?.data
    if (typeof rawData !== 'string') return
    let msg: { type: string; data?: unknown; requestId?: string }
    try { msg = JSON.parse(rawData) } catch { return }
    if (msg.type === 'ping') return wsRef.current?.send(JSON.stringify({ type: 'pong' }))
    if (msg.requestId && pendingRef.current.has(msg.requestId)) {
      const pending = pendingRef.current.get(msg.requestId)!
      pendingRef.current.delete(msg.requestId)
      if (msg.type === 'sftp-error') pending.reject(new Error((msg.data as { message: string })?.message || '未知错误'))
      else pending.resolve(msg.data)
      return
    }

    switch (msg.type) {
      case 'hostkey-verification-required':
        handleHostKeyVerification((msg.data ?? {}) as Record<string, unknown>)
        break
      case 'sftp-dir-size': {
        const d = msg.data as SftpDirSizeData
        if (d?.path && typeof d.size === 'number') store.getState().updateEntrySize(d.path, d.size, sessionId)
        break
      }
      case 'sftp-error':
        store.getState().setError((msg.data as { message: string })?.message || '未知错误', sessionId)
        break
      case 'sftp-download-chunk':
        handleDownloadChunk(msg.data as Parameters<typeof handleDownloadChunk>[0]); break
      case 'sftp-download-ok':
        handleDownloadComplete(msg.data as { transferId: string }); break
      case 'sftp-download-error': {
        const d = msg.data as { transferId: string; message: string }
        handleDownloadError(d.transferId, d.message)
        break
      }
    }
  }, [handleHostKeyVerification, pendingRef, sessionId, store, wsRef])

  const listDir = useCallback(async (path: string) => {
    const reqSeq = ++listRequestSeqRef.current
    const s = store.getState()
    s.setLoading(true, sessionId)
    try {
      const result = await request<{ path: string; entries: SftpFileEntry[] }>('sftp-list', { path })
      if (reqSeq !== listRequestSeqRef.current) return
      if (store.getState().getSessionState(sessionId).currentPath !== path) return
      store.getState().setEntries(result.entries, sessionId)
    } catch (err) {
      if (reqSeq !== listRequestSeqRef.current) return
      if (store.getState().getSessionState(sessionId).currentPath !== path) return
      store.getState().setError((err as Error).message, sessionId)
    } finally {
      if (reqSeq === listRequestSeqRef.current) store.getState().setLoading(false, sessionId)
    }
  }, [listRequestSeqRef, request, sessionId, store])

  return {
    clearPendingHostKeyPrompt,
    handleHostKeyVerification,
    request,
    send,
    handleMessage,
    listDir,
  }
}
