import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useMonitorStore } from '../../stores/useMonitorStore'
import { useKeywordHighlight } from './useKeywordHighlight'
import { getSession, setSession } from '../../stores/terminalSessionRegistry'
import type { TerminalSession } from '../../stores/terminalSessionRegistry'
import '@xterm/xterm/css/xterm.css'

/** SSH 连接参数 */
interface SshConnection {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
}

/** 本地终端参数 */
interface LocalConnection {
  type: 'local'
  shell: string
  workingDir?: string
  initialCommand?: string
}

export type TerminalConnection = SshConnection | LocalConnection

interface SshTerminalProps {
  /** 面板 ID，用于注册表持久化 */
  paneId: string
  /** 标签页 ID，用于监控数据关联 */
  tabId?: string
  wsUrl?: string
  connection: TerminalConnection | null
  /** 连接 ID，用于后端写入连接日志 */
  connectionId?: string | null
  profileId?: string | null
  onStatusChange?: (status: 'connecting' | 'connected' | 'closed' | 'error') => void
  onContextMenu?: (x: number, y: number, hasSelection: boolean) => void
}

export default function SshTerminal({ paneId, tabId, wsUrl = 'ws://localhost:3001/ws/ssh', connection, connectionId, profileId, onStatusChange, onContextMenu }: SshTerminalProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [cellHeight, setCellHeight] = useState(0)

  // 用 ref 保持回调最新引用，避免闭包陈旧
  const onStatusChangeRef = useRef(onStatusChange)
  onStatusChangeRef.current = onStatusChange

  /** 安全 fit：仅在容器有有效尺寸时才调用 fitAddon.fit() */
  const safeFit = useCallback((fitAddon: FitAddon) => {
    const container = wrapperRef.current
    if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return
    try { fitAddon.fit() } catch { /* 静默 */ }
  }, [])

  /** 从 xterm 内部获取实际 cell height，用于条纹对齐 */
  const updateCellHeight = useCallback(() => {
    const s = getSession(paneId)
    if (!s) return
    try {
      const h = (s.term as any)._core._renderService.dimensions.css.cell.height
      if (h > 0) setCellHeight(h)
    } catch { /* 静默 */ }
  }, [paneId])

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
    const isLocal = 'type' in conn && conn.type === 'local'

    const ws = new WebSocket(wsUrl)
    session.ws = ws
    wsRef.current = ws

    ws.onopen = () => {
      session.reconnectCount = 0
      // 先发送高亮配置（后端可在连接前接收并准备好拦截器）
      sendHighlightConfig(ws)
      // 安全 fit 后再取尺寸
      safeFit(fitAddon)
      const dims = fitAddon.proposeDimensions()
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
        ws.send(JSON.stringify({ type: 'connect', data: { ...conn, connectionId } }))
      }
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
            // 非本地终端时启动监控采集
            if (!isLocal && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'monitor-start' }))
            }
            // 延迟确保 DOM 完全稳定后同步正确尺寸
            setTimeout(() => {
              safeFit(fitAddon)
              // fit() 触发 term.onResize → 自动同步后端
              // 额外显式发送，防止尺寸未变时 onResize 不触发
              const dims = fitAddon.proposeDimensions()
              if (dims && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
              }
            }, 50)
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
        case 'monitor-data':
          if (tabId) useMonitorStore.getState().updateSnapshot(tabId, msg.data)
          break
        case 'monitor-info':
          if (tabId) useMonitorStore.getState().updateSysInfo(tabId, msg.data)
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
      } else {
        // 自动重连耗尽，提示按任意键手动重连
        term.writeln('\r\n\x1b[36m[Vortix]\x1b[0m 按任意键重新连接...')
        const disposable = term.onData(() => {
          disposable.dispose()
          session.reconnectCount = 0
          onStatusChangeRef.current?.('connecting')
          connectWs(session, conn)
        })
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

      // 延迟确保 DOM 完全显示后再刷新尺寸
      setTimeout(() => {
        const s = getSession(paneId)
        if (!s) return
        // 强制全量重绘终端缓冲区（修复 starship 等复杂 ANSI 渲染）
        s.term.refresh(0, s.term.rows - 1)
        safeFit(s.fitAddon)
        // fit() 会触发 term.onResize → 自动同步后端
        // 额外显式发送一次，防止尺寸未变时 onResize 不触发
        const dims = s.fitAddon.proposeDimensions()
        if (dims && s.ws?.readyState === WebSocket.OPEN) {
          s.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
        }
        updateCellHeight()
      }, 100)
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
        fontLigatures: settings.fontLigatures,
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
      safeFit(fitAddon)

      const session: TerminalSession = {
        containerEl, term, fitAddon, searchAddon,
        ws: null, reconnectTimer: null, reconnectCount: 0, isManualDisconnect: false,
      }
      setSession(paneId, session)

      termRef.current = term
      fitAddonRef.current = fitAddon

      // 核心：监听 xterm 内部 resize 事件，自动同步 cols/rows 到后端
      term.onResize(({ cols, rows }) => {
        const s = getSession(paneId)
        if (s?.ws?.readyState === WebSocket.OPEN) {
          s.ws.send(JSON.stringify({ type: 'resize', data: { cols, rows } }))
        }
      })

      const isLocalConn = 'type' in connection && connection.type === 'local'
      const connectMsg = isLocalConn
        ? `正在启动 ${connection.shell} 终端...`
        : `正在连接 ${(connection as SshConnection).host}:${(connection as SshConnection).port} ...`
      term.writeln('\x1b[36m[Vortix]\x1b[0m ' + connectMsg)
      onStatusChangeRef.current?.('connecting')

      // 延迟连接，确保容器布局完全稳定后再取尺寸
      setTimeout(() => {
        safeFit(fitAddon)
        connectWs(session, connection)
        updateCellHeight()
      }, 50)

      // 字体加载完成后重新 fit（Nerd Font 等特殊字体会改变字符宽度）
      document.fonts.ready.then(() => {
        safeFit(fitAddon)
        updateCellHeight()
      })
    }

    // ── 绑定 Observers ──
    const handleResize = () => {
      const s = getSession(paneId)
      if (!s) return
      // 仅在容器有有效尺寸时才 fit，防止切走时 0 尺寸破坏终端状态
      const container = wrapperRef.current
      if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return
      safeFit(s.fitAddon)
      const dims = s.fitAddon.proposeDimensions()
      if (dims && s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
      }
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(wrapper)

    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const s = getSession(paneId)
          if (!s) return
          s.term.refresh(0, s.term.rows - 1)
          safeFit(s.fitAddon)
          // fit() 触发 onResize 自动同步，额外显式发送防止尺寸未变
          const dims = s.fitAddon.proposeDimensions()
          if (dims && s.ws?.readyState === WebSocket.OPEN) {
            s.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
          }
        }
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
      s.term.options.lineHeight = r.profile.lineHeight || 1
      s.term.options.letterSpacing = r.profile.letterSpacing || 0
      s.term.options.scrollback = r.profile.scrollback || 1000
      s.term.options.cursorStyle = r.profile.cursorStyle
      s.term.options.cursorBlink = r.profile.cursorBlink
      s.term.options.fontLigatures = settings.fontLigatures
      s.containerEl.style.backgroundColor = r.theme.background ?? ''
      safeFit(s.fitAddon)
      setTimeout(updateCellHeight, 50)
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

  // Ctrl+V 粘贴 / Ctrl+Shift+C 复制 / Ctrl+Shift+V 粘贴
  useEffect(() => {
    const s = getSession(paneId)
    if (!s) return
    s.term.attachCustomKeyEventHandler((e) => {
      // 调试模式下放行 F12（不让 xterm 吞掉）
      if (e.key === 'F12' && useSettingsStore.getState().debugMode) return false
      // Ctrl+Shift+C — 复制选中文本
      if (e.ctrlKey && e.shiftKey && e.key === 'C' && e.type === 'keydown') {
        const sel = s.term.getSelection()
        if (sel) navigator.clipboard.writeText(sel).catch(() => {})
        return false
      }
      // Ctrl+Shift+V — 粘贴
      if (e.ctrlKey && e.shiftKey && e.key === 'V' && e.type === 'keydown') {
        navigator.clipboard.readText().then((text) => {
          const cur = getSession(paneId)
          if (text && cur?.ws?.readyState === WebSocket.OPEN) {
            cur.ws.send(JSON.stringify({ type: 'input', data: text }))
          }
        }).catch(() => {})
        return false
      }
      // Ctrl+V — 粘贴（设置开关）
      const { termCtrlVPaste } = useSettingsStore.getState()
      if (termCtrlVPaste && e.ctrlKey && !e.shiftKey && e.key === 'v' && e.type === 'keydown') {
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

  // 终端内快捷键阻止冒泡（防止 Ctrl+Shift+C/V 被全局 DevTools 拦截吞掉）
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.key === 'V' || e.key === 'v')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    wrapper.addEventListener('keydown', handler)
    return () => wrapper.removeEventListener('keydown', handler)
  }, [])

  // 鼠标中键操作
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handler = (e: MouseEvent) => {
      if (e.button !== 1) return // 仅中键
      const action = useSettingsStore.getState().termMiddleClickAction
      if (action === 'paste') {
        e.preventDefault()
        navigator.clipboard.readText().then((text) => {
          const s = getSession(paneId)
          if (text && s?.ws?.readyState === WebSocket.OPEN) {
            s.ws.send(JSON.stringify({ type: 'input', data: text }))
          }
        }).catch(() => {})
      }
    }
    wrapper.addEventListener('mousedown', handler)
    return () => wrapper.removeEventListener('mousedown', handler)
  }, [paneId])

  // 终端关键词高亮
  useKeywordHighlight({ termRef, profileId })

  // 终端内 Ctrl+Scroll 缩放字体（不影响外部 UI 缩放）
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      e.stopPropagation()
      if (!useSettingsStore.getState().termZoomEnabled) return
      const s = getSession(paneId)
      if (!s) return
      const current = s.term.options.fontSize ?? 14
      const next = e.deltaY < 0 ? Math.min(40, current + 1) : Math.max(8, current - 1)
      if (next !== current) {
        s.term.options.fontSize = next
        safeFit(s.fitAddon)
        setTimeout(updateCellHeight, 0)
      }
    }
    wrapper.addEventListener('wheel', handler, { passive: false })
    return () => wrapper.removeEventListener('wheel', handler)
  }, [paneId, safeFit, updateCellHeight])

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
  const termStripeEnabled = useSettingsStore((s) => s.termStripeEnabled)

  return (
    <div className="w-full h-full relative">
      <div
        ref={wrapperRef}
        className="w-full h-full terminal-container transition-colors duration-300"
        style={{ backgroundColor: containerBg }}
        onContextMenu={(e) => {
          e.preventDefault()
          const action = useSettingsStore.getState().termRightClickAction
          if (action === 'paste') {
            // 右键粘贴模式
            navigator.clipboard.readText().then((text) => {
              const s = getSession(paneId)
              if (text && s?.ws?.readyState === WebSocket.OPEN) {
                s.ws.send(JSON.stringify({ type: 'input', data: text }))
              }
            }).catch(() => {})
          } else {
            // 右键菜单模式（默认）
            const hasSelection = !!termRef.current?.getSelection()
            onContextMenu?.(e.clientX, e.clientY, hasSelection)
          }
        }}
      />
      {termStripeEnabled && cellHeight > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            backgroundImage: `repeating-linear-gradient(to bottom,
              transparent 0px, transparent ${cellHeight}px,
              ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} ${cellHeight}px,
              ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} ${cellHeight * 2}px)`,
          }}
        />
      )}
    </div>
  )
}