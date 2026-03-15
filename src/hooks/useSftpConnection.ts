/* ── SFTP WebSocket 连接生命周期管理 ── */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useSftpStore } from '../stores/useSftpStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { handleDownloadChunk, handleDownloadComplete, handleDownloadError } from '../services/transfer-engine'
import type { SftpFileEntry, ExecResult } from '../types/sftp'

/** 获取后端 WebSocket 地址 */
function getSftpWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.hostname}:3001/ws/sftp`
}

interface ConnectParams {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
  connectionId?: string
  connectionName?: string
}

let requestCounter = 0
function nextRequestId(): string {
  return `sftp-${++requestCounter}-${Date.now()}`
}

export function useSftpConnection() {
  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map())

  const store = useSftpStore

  /** 发送消息并等待响应 */
  const request = useCallback(<T = unknown>(type: string, data?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('SFTP 未连接'))
        return
      }
      const requestId = nextRequestId()
      pendingRef.current.set(requestId, {
        resolve: resolve as (v: unknown) => void,
        reject,
      })
      ws.send(JSON.stringify({ type, data, requestId }))
      // 超时：读取设置中的 sftpListTimeout（秒），默认 60s
      const timeoutMs = (useSettingsStore.getState().sftpListTimeout || 60) * 1000
      setTimeout(() => {
        if (pendingRef.current.has(requestId)) {
          pendingRef.current.delete(requestId)
          reject(new Error('请求超时'))
        }
      }, timeoutMs)
    })
  }, [])

  /** 发送消息（不等待响应） */
  const send = useCallback((type: string, data?: unknown) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type, data }))
  }, [])

  /** 处理服务端消息 */
  const handleMessage = useCallback((ev: MessageEvent) => {
    let msg: { type: string; data?: unknown; requestId?: string }
    try { msg = JSON.parse(ev.data) } catch { return }
    if (msg.type === 'ping') {
      wsRef.current?.send(JSON.stringify({ type: 'pong' }))
      return
    }

    // 匹配 requestId 的 promise
    if (msg.requestId && pendingRef.current.has(msg.requestId)) {
      const pending = pendingRef.current.get(msg.requestId)!
      pendingRef.current.delete(msg.requestId)
      if (msg.type === 'sftp-error') {
        pending.reject(new Error((msg.data as { message: string })?.message || '未知错误'))
      } else {
        pending.resolve(msg.data)
      }
      return
    }

    // 无 requestId 的广播消息
    switch (msg.type) {
      case 'sftp-error': {
        const errMsg = (msg.data as { message: string })?.message || '未知错误'
        store.getState().setError(errMsg)
        break
      }
      case 'sftp-upload-progress':
      case 'sftp-upload-ok':
        // transfer-engine 内部追踪上传进度，无需额外处理
        break
      case 'sftp-download-chunk':
        handleDownloadChunk(msg.data as Parameters<typeof handleDownloadChunk>[0])
        break
      case 'sftp-download-ok':
        handleDownloadComplete(msg.data as { transferId: string })
        break
      case 'sftp-download-error': {
        const d = msg.data as { transferId: string; message: string }
        handleDownloadError(d.transferId, d.message)
        break
      }
    }
  }, [store])

  /** 列出目录 */
  const listDir = useCallback(async (path: string) => {
    const s = store.getState()
    s.setLoading(true)
    try {
      const result = await request<{ path: string; entries: SftpFileEntry[] }>('sftp-list', { path })
      store.getState().setEntries(result.entries)
    } catch (err) {
      store.getState().setError((err as Error).message)
    } finally {
      store.getState().setLoading(false)
    }
  }, [store, request])

  /** 建立 SFTP 连接 */
  const connect = useCallback(async (params: ConnectParams) => {
    const s = store.getState()
    if (s.connected || s.connecting) return
    s.setConnecting(true)
    s.setError(null)

    const ws = new WebSocket(getSftpWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'sftp-connect',
        data: params,
        requestId: nextRequestId(),
      }))
    }

    ws.onmessage = (ev) => {
      let msg: { type: string; data?: unknown; requestId?: string }
      try { msg = JSON.parse(ev.data) } catch { return }

      if (msg.type === 'sftp-ready') {
        const home = (msg.data as { home: string })?.home || '/'
        const st = store.getState()
        st.setConnecting(false)
        st.setConnected(true)
        st.setHomePath(home)
        st.setConnectionInfo(params.connectionId ?? '', params.connectionName ?? '')
        st.navigateTo(home)
        // 切换到正常消息处理
        ws.onmessage = (e) => handleMessage(e)
        // 立即加载目录
        void listDir(home)
      } else if (msg.type === 'sftp-error') {
        const errMsg = (msg.data as { message: string })?.message || '连接失败'
        const st = store.getState()
        st.setConnecting(false)
        st.setError(errMsg)
      }
    }

    ws.onerror = () => {
      const st = store.getState()
      st.setConnecting(false)
      st.setError('WebSocket 连接失败')
    }

    ws.onclose = () => {
      wsRef.current = null
      const st = store.getState()
      st.setConnected(false)
      st.setConnecting(false)
    }
  }, [store, handleMessage, listDir])

  /** 创建目录 */
  const mkdir = useCallback(async (path: string) => {
    await request('sftp-mkdir', { path })
  }, [request])

  /** 重命名 */
  const rename = useCallback(async (oldPath: string, newPath: string) => {
    await request('sftp-rename', { oldPath, newPath })
  }, [request])

  /** 删除 */
  const remove = useCallback(async (path: string, isDir: boolean) => {
    await request('sftp-delete', { path, isDir })
  }, [request])

  /** 读取文件内容 */
  const readFile = useCallback(async (path: string): Promise<string> => {
    const result = await request<{ path: string; content: string }>('sftp-read-file', { path })
    return result.content
  }, [request])

  /** 写入文件内容 */
  const writeFile = useCallback(async (path: string, content: string) => {
    await request('sftp-write-file', { path, content })
  }, [request])

  /** 获取文件信息 */
  const stat = useCallback(async (path: string) => {
    return request<SftpFileEntry>('sftp-stat', { path })
  }, [request])

  /** 修改权限 */
  const chmod = useCallback(async (path: string, mode: string, recursive = false) => {
    await request('sftp-chmod', { path, mode, recursive })
  }, [request])

  /** 新建空文件或目录 */
  const touch = useCallback(async (path: string, isDir = false) => {
    await request('sftp-touch', { path, isDir })
  }, [request])

  /** 远程执行命令（白名单限制） */
  const exec = useCallback(async (command: string): Promise<ExecResult> => {
    return request<ExecResult>('sftp-exec', { command })
  }, [request])

  /** 断开连接 */
  const disconnect = useCallback(() => {
    send('sftp-disconnect')
    wsRef.current?.close()
    wsRef.current = null
    store.getState().reset()
  }, [send, store])

  /** 刷新当前目录 */
  const refresh = useCallback(() => {
    const { currentPath } = store.getState()
    listDir(currentPath)
  }, [store, listDir])

  // 组件卸载时清理
  useEffect(() => {
    const pending = pendingRef.current
    return () => {
      wsRef.current?.close()
      wsRef.current = null
      pending.clear()
    }
  }, [])

  return useMemo(() => ({
    connect,
    disconnect,
    listDir,
    mkdir,
    rename,
    remove,
    readFile,
    writeFile,
    stat,
    chmod,
    touch,
    exec,
    refresh,
    send,
  }), [connect, disconnect, listDir, mkdir, rename, remove, readFile, writeFile, stat, chmod, touch, exec, refresh, send])
}
