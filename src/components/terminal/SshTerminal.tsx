import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useKeywordHighlight } from './useKeywordHighlight'
import '@xterm/xterm/css/xterm.css'

interface SshTerminalProps {
  /** WebSocket 服务地址 */
  wsUrl?: string
  /** SSH 连接参数 */
  connection: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
  } | null
  /** 连接绑定的 Profile ID（不传则使用全局 activeProfileId） */
  profileId?: string | null
  /** 连接状态回调 */
  onStatusChange?: (status: 'connecting' | 'connected' | 'closed' | 'error') => void
  /** 右键菜单回调 */
  onContextMenu?: (x: number, y: number, hasSelection: boolean) => void
}

export default function SshTerminal({ wsUrl = 'ws://localhost:3001/ws/ssh', connection, profileId, onStatusChange, onContextMenu }: SshTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectCountRef = useRef(0)
  const isManualDisconnectRef = useRef(false)

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
    termRef.current?.dispose()
    termRef.current = null
    fitAddonRef.current = null
  }, [])

  /** 建立 WebSocket 连接（支持重连） */
  const connectWs = useCallback((term: Terminal, fitAddon: FitAddon, conn: NonNullable<SshTerminalProps['connection']>) => {
    const settings = useSettingsStore.getState()

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectCountRef.current = 0
      ws.send(JSON.stringify({
        type: 'connect',
        data: conn,
      }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'output':
          term.write(msg.data)
          break
        case 'status':
          if (msg.data === 'connected') {
            term.writeln('\x1b[32m[Vortix]\x1b[0m 连接成功！')
            onStatusChange?.('connected')
            const dims = fitAddon.proposeDimensions()
            if (dims) {
              ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
            }
          } else if (msg.data === 'closed') {
            term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m 连接已断开')
            onStatusChange?.('closed')
          } else if (msg.data === 'timeout') {
            term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m 连接超时断开')
            onStatusChange?.('closed')
          }
          break
        case 'ping':
          // 响应服务端心跳
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }))
          }
          break
        case 'error':
          term.writeln('\r\n\x1b[31m[Vortix 错误]\x1b[0m ' + msg.data)
          onStatusChange?.('error')
          break
      }
    }

    ws.onclose = () => {
      if (isManualDisconnectRef.current) return

      term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m WebSocket 已断开')
      onStatusChange?.('closed')

      // 自动重连
      const maxRetries = settings.autoReconnect ? settings.reconnectCount : 0
      const interval = settings.reconnectInterval * 1000

      if (reconnectCountRef.current < maxRetries) {
        reconnectCountRef.current++
        term.writeln(`\x1b[36m[Vortix]\x1b[0m 正在尝试重连 (${reconnectCountRef.current}/${maxRetries})...`)
        onStatusChange?.('connecting')
        reconnectTimerRef.current = setTimeout(() => {
          if (wsRef.current === ws) {
            connectWs(term, fitAddon, conn)
          }
        }, interval)
      }
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m[Vortix]\x1b[0m WebSocket 连接失败，请确认后端服务已启动')
      onStatusChange?.('error')
    }

    // 终端输入 -> WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })
  }, [wsUrl, onStatusChange])

  useEffect(() => {
    if (!containerRef.current || !connection) return

    isManualDisconnectRef.current = false
    cleanup()

    // 从 Profile 读取终端配置
    const settings = useSettingsStore.getState()
    const isDark = document.documentElement.classList.contains('dark')
    const resolved = useTerminalProfileStore.getState()
      .resolveProfile(profileId ?? settings.activeProfileId, isDark)

    // 初始化 xterm
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

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(webLinksAddon)

    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    term.writeln('\x1b[36m[Vortix]\x1b[0m 正在连接 ' + connection.host + ':' + connection.port + ' ...')
    onStatusChange?.('connecting')

    // 建立连接
    connectWs(term, fitAddon, connection)

    // 窗口 resize
    const handleResize = () => {
      fitAddon.fit()
      const dims = fitAddon.proposeDimensions()
      if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(containerRef.current)

    // IntersectionObserver：标签切换回来时自动 fit
    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          fitAddon.fit()
        }
      }
    })
    intersectionObserver.observe(containerRef.current)

    return () => {
      isManualDisconnectRef.current = true
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      cleanup()
    }
  }, [connection, wsUrl, onStatusChange, cleanup, connectWs])

  // 统一监听 Profile / Settings / dark mode 变化，动态更新终端
  useEffect(() => {
    const applyProfile = () => {
      if (!termRef.current) return
      const s = useSettingsStore.getState()
      const isDark = document.documentElement.classList.contains('dark')
      const r = useTerminalProfileStore.getState()
        .resolveProfile(profileId ?? s.activeProfileId, isDark)

      termRef.current.options.theme = r.theme
      termRef.current.options.fontFamily = r.fontFamily
      termRef.current.options.fontSize = r.profile.fontSize
      termRef.current.options.lineHeight = r.profile.lineHeight || 1.6
      termRef.current.options.letterSpacing = r.profile.letterSpacing || 0
      termRef.current.options.scrollback = r.profile.scrollback || 1000
      termRef.current.options.cursorStyle = r.profile.cursorStyle
      termRef.current.options.cursorBlink = r.profile.cursorBlink
      if (containerRef.current) {
        containerRef.current.style.backgroundColor = r.theme.background ?? ''
      }
      fitAddonRef.current?.fit()
    }

    const unsub1 = useTerminalProfileStore.subscribe(applyProfile)
    const unsub2 = useSettingsStore.subscribe(applyProfile)
    const observer = new MutationObserver(applyProfile)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => { unsub1(); unsub2(); observer.disconnect() }
  }, [profileId])

  // 鼠标选中自动复制
  useEffect(() => {
    if (!termRef.current) return
    const term = termRef.current
    const disposable = term.onSelectionChange(() => {
      const { termSelectAutoCopy } = useSettingsStore.getState()
      if (!termSelectAutoCopy) return
      const sel = term.getSelection()
      if (sel) navigator.clipboard.writeText(sel).catch(() => {})
    })
    return () => disposable.dispose()
  }, [])

  // Ctrl+V 粘贴拦截
  useEffect(() => {
    if (!termRef.current) return
    const term = termRef.current
    term.attachCustomKeyEventHandler((e) => {
      const { termCtrlVPaste } = useSettingsStore.getState()
      if (termCtrlVPaste && e.ctrlKey && e.key === 'v' && e.type === 'keydown') {
        navigator.clipboard.readText().then((text) => {
          if (text && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'input', data: text }))
          }
        }).catch(() => {})
        return false
      }
      return true
    })
  }, [])

  // 终端关键词高亮
  useKeywordHighlight({ termRef, profileId })

  const isDark = document.documentElement.classList.contains('dark')

  // 容器背景色跟随当前 Profile 主题
  const settings = useSettingsStore.getState()
  const resolved = useTerminalProfileStore.getState()
    .resolveProfile(profileId ?? settings.activeProfileId, isDark)
  const containerBg = resolved.theme.background ?? (isDark ? '#1E1E1E' : '#FFFFFF')

  return (
    <div
      ref={containerRef}
      className="w-full h-full terminal-container transition-colors duration-300"
      style={{
        backgroundColor: containerBg,
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        const hasSelection = !!termRef.current?.getSelection()
        onContextMenu?.(e.clientX, e.clientY, hasSelection)
      }}
    />
  )
}
