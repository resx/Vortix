import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useKeywordHighlight } from './useKeywordHighlight'
import { getSession, setSession } from '../../stores/terminalSessionRegistry'
import type { TerminalSession } from '../../stores/terminalSessionRegistry'
import '@xterm/xterm/css/xterm.css'

interface SshTerminalProps {
  /** 面板 ID，用于注册表持久化 */
  paneId: string
  wsUrl?: string
  connection: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
  } | null
  profileId?: string | null
  onStatusChange?: (status: 'connecting' | 'connected' | 'closed' | 'error') => void
  onContextMenu?: (x: number, y: number, hasSelection: boolean) => void
}

export default function SshTerminal({ paneId, wsUrl = 'ws://localhost:3001/ws/ssh', connection, profileId, onStatusChange, onContextMenu }: SshTerminalProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // 用 ref 保持回调最新引用，避免闭包陈旧
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange

  /** 发送高亮配置到后端 */
  const sendHighlightConfig = useCallback((ws: WebSocket) => {
    if (ws.readyState !== WebSocket.OPEN) return
    const settings = useSettingsStore.getState()
    const ps = useTerminalProfileStore.getState()
    const profile = ps.getProfileById(profileId ?? settings.activeProfileId)
      ?? ps.getDefaultProfile()
    ws.send(JSON.stringify({
      type: 'highlight-config',
      data: {
        enabled: settings.termHighlightEnhance,
        colors: profile.keywordHighlights,
      },
    }))
  }, [profileId])

  /** 建立 WebSocket 连接（支持重连） */
  const connectWs = useCallback((session: TerminalSession, conn: NonNullable<SshTerminalProps['connection']>) => {
    const settings = useSettingsStore.getState()
    const { term, fitAddon } = session

    const ws = new WebSocket(wsUrl)
    session.ws = ws
    wsRef.current = ws

    ws.onopen = () => {
      session.reconnectCount = 0
      // 先发送高亮配置（后端可在连接前接收并准备好拦截器）
      sendHighlightConfig(ws)
      ws.send(JSON.stringify({ type: 'connect', data: conn }))
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
            onStatusChangeRef.current?.('connected')
            const dims = fitAddon.proposeDimensions()
            if (dims) {
              ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
            }
          } else if (msg.data === 'closed') {
            term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m 连接已断开')
            onStatusChangeRef.current?.('closed')
          } else if (msg.data === 'timeout') {
            term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m 连接超时断开')
            onStatusChangeRef.current?.('closed')
          }
          break
        case 'ping':
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }))
          }
          break
        case 'highlight-config-ack':
          // 后端确认高亮配置已应用
          break
        case 'error':
          term.writeln('\r\n\x1b[31m[Vortix 错误]\x1b[0m ' + msg.data)
          onStatusChangeRef.current?.('error')
          break
      }
    }

    ws.onclose = () => {
      if (session.isManualDisconnect) return
      term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m WebSocket 已断开')
      onStatusChangeRef.current?.('closed')

      const maxRetries = settings.autoReconnect ? settings.reconnectCount : 0
      const interval = settings.reconnectInterval * 1000
      if (session.reconnectCount < maxRetries) {
        session.reconnectCount++
        term.writeln(`\x1b[36m[Vortix]\x1b[0m 正在尝试重连 (${session.reconnectCount}/${maxRetries})...`)
        onStatusChangeRef.current?.('connecting')
        session.reconnectTimer = setTimeout(() => {
          if (session.ws === ws) connectWs(session, conn)
        }, interval)
      }
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m[Vortix]\x1b[0m WebSocket 连接失败，请确认后端服务已启动')
      onStatusChangeRef.current?.('error')
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }))
      }
    })
  }, [wsUrl, sendHighlightConfig])

  // 主 effect：挂载恢复 / 首次创建
  useEffect(() => {
    if (!wrapperRef.current || !connection) return
    const wrapper = wrapperRef.current

    const existing = getSession(paneId)

    if (existing) {
      // ── 恢复已有会话：复用 DOM + Terminal + WebSocket ──
      wrapper.appendChild(existing.containerEl)
      termRef.current = existing.term
      fitAddonRef.current = existing.fitAddon
      wsRef.current = existing.ws
      requestAnimationFrame(() => {
        existing.fitAddon.fit()
        const dims = existing.fitAddon.proposeDimensions()
        if (dims && existing.ws?.readyState === WebSocket.OPEN) {
          existing.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
        }
      })
    } else {
      // ── 首次创建会话 ──
      const settings = useSettingsStore.getState()
      const isDark = document.documentElement.classList.contains('dark')
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

      const fitAddon = new FitAddon()
      const searchAddon = new SearchAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(searchAddon)
      term.loadAddon(new WebLinksAddon())

      const containerEl = document.createElement('div')
      containerEl.style.width = '100%'
      containerEl.style.height = '100%'
      wrapper.appendChild(containerEl)
      term.open(containerEl)
      fitAddon.fit()

      const session: TerminalSession = {
        containerEl, term, fitAddon, searchAddon,
        ws: null, reconnectTimer: null, reconnectCount: 0, isManualDisconnect: false,
      }
      setSession(paneId, session)

      termRef.current = term
      fitAddonRef.current = fitAddon

      term.writeln('\x1b[36m[Vortix]\x1b[0m 正在连接 ' + connection.host + ':' + connection.port + ' ...')
      onStatusChangeRef.current?.('connecting')
      connectWs(session, connection)
    }

    // ── 绑定 Observers ──
    const handleResize = () => {
      const s = getSession(paneId)
      if (!s) return
      s.fitAddon.fit()
      const dims = s.fitAddon.proposeDimensions()
      if (dims && s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
      }
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(wrapper)

    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) getSession(paneId)?.fitAddon.fit()
      }
    })
    intersectionObserver.observe(wrapper)

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      // 从 wrapper 分离 containerEl（防止 React 移除 wrapper 时一起销毁）
      const s = getSession(paneId)
      if (s && wrapper.contains(s.containerEl)) {
        wrapper.removeChild(s.containerEl)
      }
      termRef.current = null
      fitAddonRef.current = null
      wsRef.current = null
      // 不销毁会话！会话保留在注册表中
    }
  }, [paneId, connection, connectWs, profileId])

  // 统一监听 Profile / Settings / dark mode 变化
  useEffect(() => {
    const applyProfile = () => {
      const s = getSession(paneId)
      if (!s) return
      const settings = useSettingsStore.getState()
      const isDark = document.documentElement.classList.contains('dark')
      const r = useTerminalProfileStore.getState()
        .resolveProfile(profileId ?? settings.activeProfileId, isDark)

      s.term.options.theme = r.theme
      s.term.options.fontFamily = r.fontFamily
      s.term.options.fontSize = r.profile.fontSize
      s.term.options.lineHeight = r.profile.lineHeight || 1.6
      s.term.options.letterSpacing = r.profile.letterSpacing || 0
      s.term.options.scrollback = r.profile.scrollback || 1000
      s.term.options.cursorStyle = r.profile.cursorStyle
      s.term.options.cursorBlink = r.profile.cursorBlink
      s.containerEl.style.backgroundColor = r.theme.background ?? ''
      s.fitAddon.fit()
    }

    const unsub1 = useTerminalProfileStore.subscribe(applyProfile)
    const unsub2 = useSettingsStore.subscribe(applyProfile)
    const observer = new MutationObserver(applyProfile)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => { unsub1(); unsub2(); observer.disconnect() }
  }, [paneId, profileId])

  // 鼠标选中自动复制
  useEffect(() => {
    const s = getSession(paneId)
    if (!s) return
    const disposable = s.term.onSelectionChange(() => {
      const { termSelectAutoCopy } = useSettingsStore.getState()
      if (!termSelectAutoCopy) return
      const sel = s.term.getSelection()
      if (sel) navigator.clipboard.writeText(sel).catch(() => {})
    })
    return () => disposable.dispose()
  }, [paneId])

  // Ctrl+V 粘贴拦截
  useEffect(() => {
    const s = getSession(paneId)
    if (!s) return
    s.term.attachCustomKeyEventHandler((e) => {
      const { termCtrlVPaste } = useSettingsStore.getState()
      if (termCtrlVPaste && e.ctrlKey && e.key === 'v' && e.type === 'keydown') {
        navigator.clipboard.readText().then((text) => {
          const cur = getSession(paneId)
          if (text && cur?.ws?.readyState === WebSocket.OPEN) {
            cur.ws.send(JSON.stringify({ type: 'input', data: text }))
          }
        }).catch(() => {})
        return false
      }
      return true
    })
  }, [paneId])

  // 终端关键词高亮
  useKeywordHighlight({ termRef, profileId })

  // 监听设置/Profile 变化，实时推送高亮配置到后端
  useEffect(() => {
    const pushConfig = () => {
      const ws = wsRef.current
      if (ws) sendHighlightConfig(ws)
    }
    const unsub1 = useTerminalProfileStore.subscribe(pushConfig)
    const unsub2 = useSettingsStore.subscribe((s, prev) => {
      if (s.termHighlightEnhance !== prev.termHighlightEnhance ||
          s.keywordHighlights !== prev.keywordHighlights) {
        pushConfig()
      }
    })
    return () => { unsub1(); unsub2() }
  }, [sendHighlightConfig])

  const isDark = document.documentElement.classList.contains('dark')
  const settings = useSettingsStore.getState()
  const resolved = useTerminalProfileStore.getState()
    .resolveProfile(profileId ?? settings.activeProfileId, isDark)
  const containerBg = resolved.theme.background ?? (isDark ? '#1E1E1E' : '#FFFFFF')

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full terminal-container transition-colors duration-300"
      style={{ backgroundColor: containerBg }}
      onContextMenu={(e) => {
        e.preventDefault()
        const hasSelection = !!termRef.current?.getSelection()
        onContextMenu?.(e.clientX, e.clientY, hasSelection)
      }}
    />
  )
}