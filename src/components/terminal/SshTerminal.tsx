import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { DEFAULT_TERMINAL_HIGHLIGHT_RULES, normalizeTerminalHighlightRules, useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useMonitorStore } from '../../stores/useMonitorStore'
import { useTabStore } from '../../stores/useTabStore'
import { useKeywordHighlight } from './useKeywordHighlight'
import { getSession, setSession, notifyInputListeners, addInputListener, removeInputListener } from '../../stores/terminalSessionRegistry'
import { getWsBaseUrl, addHistory, getHistory } from '../../api/client'
import type { TerminalSession } from '../../stores/terminalSessionRegistry'
import type { TerminalHighlightRule } from '../../stores/useSettingsStore'
import '@xterm/xterm/css/xterm.css'

/** 使用 Web Audio API 播放终端铃声 */
let bellAudioCtx: AudioContext | null = null
function playBellSound() {
  try {
    if (!bellAudioCtx) bellAudioCtx = new AudioContext()
    const ctx = bellAudioCtx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 800
    gain.gain.value = 0.08
    osc.start(ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.stop(ctx.currentTime + 0.12)
  } catch { /* 静默：用户未交互时 AudioContext 可能被阻止 */ }
}

/** SSH 连接参数 */
interface SshConnection {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
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

interface XtermInternalCore {
  _renderService?: {
    dimensions?: {
      css?: {
        cell?: {
          height?: number
        }
      }
    }
  }
}

function normalizeRegexFlags(flags?: string): string {
  const valid = new Set(['g', 'i', 'm', 's', 'u', 'y'])
  const uniq: string[] = []
  for (const ch of (flags ?? '').toLowerCase()) {
    if (valid.has(ch) && !uniq.includes(ch)) uniq.push(ch)
  }
  if (!uniq.includes('g')) uniq.unshift('g')
  return uniq.join('')
}

function compileHighlightRules(rules: TerminalHighlightRule[]): { color: string; pattern: RegExp }[] {
  const out: { color: string; pattern: RegExp }[] = []
  for (const rule of rules) {
    if (!rule.pattern?.trim()) continue
    try {
      const flags = normalizeRegexFlags(rule.flags)
      out.push({ color: rule.color, pattern: new RegExp(rule.pattern, flags) })
    } catch {
      // 忽略非法正则，避免终端渲染链路被阻断
    }
  }
  return out
}

const ANSI_ESCAPE_REGEX = new RegExp(String.raw`\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)`, 'g')

function isVortixStatusLine(text: string): boolean {
  const plain = text.replace(ANSI_ESCAPE_REGEX, '')
  return plain.trimStart().startsWith('[Vortix]')
}

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  const n = Number.parseInt(raw, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function colorWrap(text: string, color: string): string {
  const rgb = hexToRgb(color)
  if (!rgb) return text
  return `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\x1b[39m`
}

function applyHighlightToPlainText(
  text: string,
  rules: { color: string; pattern: RegExp }[],
): string {
  let output = text
  for (const rule of rules) {
    output = output.replace(rule.pattern, (m) => colorWrap(m, rule.color))
  }
  return output
}

function applyAnsiSafeHighlight(
  text: string,
  rules: { color: string; pattern: RegExp }[],
): string {
  if (isVortixStatusLine(text)) return text
  let result = ''
  let last = 0
  ANSI_ESCAPE_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ANSI_ESCAPE_REGEX.exec(text)) !== null) {
    const idx = match.index
    if (idx > last) {
      result += applyHighlightToPlainText(text.slice(last, idx), rules)
    }
    result += match[0]
    last = idx + match[0].length
  }
  if (last < text.length) {
    result += applyHighlightToPlainText(text.slice(last), rules)
  }
  return result
}

export default function SshTerminal({ paneId, tabId, wsUrl, connection, connectionId, profileId, onStatusChange, onContextMenu }: SshTerminalProps) {
  const resolvedWsUrl = wsUrl || `${getWsBaseUrl()}/ws/ssh`
  const wrapperRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const connectWsRef = useRef<((session: TerminalSession, conn: NonNullable<SshTerminalProps['connection']>) => void) | null>(null)
  const [cellHeight, setCellHeight] = useState(0)
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )
  const [hintText, setHintText] = useState('')
  const hintRef = useRef('')

  // 用 ref 保持回调最新引用，避免闭包陈旧
  const onStatusChangeRef = useRef(onStatusChange)
  useEffect(() => { onStatusChangeRef.current = onStatusChange })

  /** 安全 fit：仅在容器有有效尺寸时才调用 fitAddon.fit() */
  const safeFit = useCallback((fitAddon: FitAddon) => {
    const container = wrapperRef.current
    if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return
    try { fitAddon.fit() } catch { /* 静默 */ }
  }, [])

  /** 安全获取建议尺寸，避免隐藏状态下拿到错误结果 */
  const getProposedDimensions = useCallback((fitAddon: FitAddon) => {
    const container = wrapperRef.current
    if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return undefined
    try { return fitAddon.proposeDimensions() ?? undefined } catch { return undefined }
  }, [])

  /** 从 xterm 内部获取实际 cell height，用于条纹对齐 */
  const updateCellHeight = useCallback(() => {
    const s = getSession(paneId)
    if (!s) return
    try {
      const h = ((s.term as Terminal & { _core?: XtermInternalCore })._core?._renderService?.dimensions?.css?.cell?.height) ?? 0
      if (h > 0) setCellHeight(h)
    } catch { /* 静默 */ }
  }, [paneId])

  const stabilizeTerminalLayout = useCallback((session: TerminalSession, preferredFont?: string) => {
    const run = () => {
      safeFit(session.fitAddon)
      session.term.refresh(0, session.term.rows - 1)
      const dims = getProposedDimensions(session.fitAddon)
      if (dims && session.ws?.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
      }
      updateCellHeight()
    }

    run()
    requestAnimationFrame(() => requestAnimationFrame(run))
    window.setTimeout(run, 120)

    if (document.fonts?.ready) {
      void document.fonts.ready.then(run).catch(() => {})
    }
    if (preferredFont && document.fonts?.load) {
      void document.fonts.load(`${session.term.options.fontSize ?? 14}px ${preferredFont}`)
        .then(run)
        .catch(() => {})
    }
  }, [getProposedDimensions, safeFit, updateCellHeight])

  /** 同步渲染模式：普通模式 / WebGL 高性能模式 */
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

  /** 发送高亮配置到后端 */
  const sendHighlightConfig = useCallback((ws: WebSocket) => {
    if (ws.readyState !== WebSocket.OPEN) return
    const settings = useSettingsStore.getState()
    const rules = normalizeTerminalHighlightRules(settings.termHighlightRules)
    const colors = Object.fromEntries(rules.map(rule => [rule.id, rule.color]))
    ws.send(JSON.stringify({
      type: 'highlight-config',
      data: {
        enabled: settings.termHighlightEnhance,
        colors,
      },
    }))
  }, [])

  const getResolvedHighlightRules = useCallback((): { color: string; pattern: RegExp }[] => {
    const settings = useSettingsStore.getState()
    const sourceRules = normalizeTerminalHighlightRules(settings.termHighlightRules)
    const compiled = compileHighlightRules(sourceRules)
    if (compiled.length > 0) return compiled
    return compileHighlightRules(DEFAULT_TERMINAL_HIGHLIGHT_RULES)
  }, [])

  /** 建立 WebSocket 连接（支持重连） */
  const connectWs = useCallback((session: TerminalSession, conn: NonNullable<SshTerminalProps['connection']>) => {
    const settings = useSettingsStore.getState()
    const { term, fitAddon } = session
    const isLocal = 'type' in conn && conn.type === 'local'

    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer)
      session.reconnectTimer = null
    }
    session.reconnectInputDisposable?.dispose()
    session.reconnectInputDisposable = null

    const ws = new WebSocket(resolvedWsUrl)
    session.ws = ws
    wsRef.current = ws

    ws.onopen = () => {
      session.reconnectCount = 0
      // 先发送高亮配置（后端可在连接前接收并准备好拦截器）
      sendHighlightConfig(ws)
      // 安全 fit 后再取尺寸
      safeFit(fitAddon)
      const dims = getProposedDimensions(fitAddon)
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
        ws.send(JSON.stringify({
          type: 'connect',
          data: { ...conn, connectionId, cols: dims?.cols, rows: dims?.rows },
        }))
      }
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      switch (msg.type) {
        case 'output': {
          const outputText = String(msg.data ?? '')
          const settingsNow = useSettingsStore.getState()
          const rendered = settingsNow.termHighlightEnhance
            ? applyAnsiSafeHighlight(outputText, getResolvedHighlightRules())
            : outputText
          term.write(rendered)
        }
          // 非活跃标签页有输出时标记活动
          if (tabId && useSettingsStore.getState().tabFlashNotify) {
            const tabStore = useTabStore.getState()
            if (tabStore.activeTabId !== tabId) {
              tabStore.setTabActivity(tabId, true)
            }
          }
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
              const dims = getProposedDimensions(fitAddon)
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
          session.reconnectTimer = null
          if (session.ws === ws) connectWsRef.current?.(session, conn)
        }, interval)
      } else {
        // 自动重连耗尽，提示按任意键手动重连
        term.writeln('\r\n\x1b[36m[Vortix]\x1b[0m 按任意键重新连接...')
        session.reconnectInputDisposable?.dispose()
        session.reconnectInputDisposable = term.onData(() => {
          session.reconnectInputDisposable?.dispose()
          session.reconnectInputDisposable = null
          session.reconnectCount = 0
          onStatusChangeRef.current?.('connecting')
          connectWsRef.current?.(session, conn)
        })
      }
    }

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m[Vortix]\x1b[0m WebSocket 连接失败，请确认后端服务已启动')
      onStatusChangeRef.current?.('error')
    }

  }, [connectionId, getProposedDimensions, getResolvedHighlightRules, resolvedWsUrl, safeFit, sendHighlightConfig, tabId])
  useEffect(() => { connectWsRef.current = connectWs }, [connectWs])

  // 主 effect：挂载恢复 / 首次创建
  useEffect(() => {
    if (!wrapperRef.current || !connection) return
    const wrapper = wrapperRef.current

    const existing = getSession(paneId)

    if (existing) {
      // ── 恢复已有会话：复用 DOM + Terminal + WebSocket ──
      wrapper.appendChild(existing.containerEl)
      if (!existing.isOpened) {
        existing.term.open(existing.containerEl)
        existing.isOpened = true
      }
      termRef.current = existing.term
      fitAddonRef.current = existing.fitAddon
      wsRef.current = existing.ws
      applyPerformanceMode(existing, useSettingsStore.getState().termHighPerformance)

      // 延迟确保 DOM 完全显示后再刷新尺寸
      setTimeout(() => {
        const s = getSession(paneId)
        if (!s) return
        // 强制全量重绘终端缓冲区（修复 starship 等复杂 ANSI 渲染）
        s.term.refresh(0, s.term.rows - 1)
        safeFit(s.fitAddon)
        // fit() 会触发 term.onResize → 自动同步后端
        // 额外显式发送一次，防止尺寸未变时 onResize 不触发
        const dims = getProposedDimensions(s.fitAddon)
        if (dims && s.ws?.readyState === WebSocket.OPEN) {
          s.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
        }
        updateCellHeight()
        stabilizeTerminalLayout(s)
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
      term.loadAddon(new WebLinksAddon((e, uri) => {
        // 仅 Ctrl+Click（macOS 为 Cmd+Click）时打开链接
        if (e.ctrlKey || e.metaKey) {
          window.open(uri, '_blank', 'noopener')
        }
      }, {
        hover: (_e, uri) => {
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
      // 注意：不在此处立即 safeFit，等字体加载完成后再测量，避免缓存错误的 cell 尺寸

      const session: TerminalSession = {
        containerEl, term, fitAddon, searchAddon,
        webglAddon: null,
        isOpened: false,
        ws: null, reconnectTimer: null, reconnectCount: 0, isManualDisconnect: false,
        inputDisposable: null, reconnectInputDisposable: null,
        commandBuffer: '', historyCache: [], lastRecordedCommand: '',
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
      session.inputDisposable = term.onData((data) => {
        const current = getSession(paneId)
        if (current?.ws?.readyState === WebSocket.OPEN) {
          current.ws.send(JSON.stringify({ type: 'input', data }))
        }
        notifyInputListeners(paneId, data)
      })

      // 终端铃声：监听 bell 事件，根据 termSound 设置播放
      term.onBell(() => {
        if (useSettingsStore.getState().termSound) playBellSound()
      })

      const isLocalConn = 'type' in connection && connection.type === 'local'
      const connectMsg = isLocalConn
        ? `正在启动 ${connection.shell} 终端...`
        : `正在连接 ${(connection as SshConnection).host}:${(connection as SshConnection).port} ...`
      term.writeln('\x1b[36m[Vortix]\x1b[0m ' + connectMsg)
      onStatusChangeRef.current?.('connecting')
      const preferredFont = resolved.fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '')

      // ???????,???????????? term.open + fit + ??
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
        // ?????????/?????????? term.open,???? metrics ????????????
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

    // ── 绑定 Observers ──
    let resizeRafId = 0
    const handleResize = () => {
      cancelAnimationFrame(resizeRafId)
      resizeRafId = requestAnimationFrame(() => {
        const s = getSession(paneId)
        if (!s) return
        // 仅在容器有有效尺寸时才 fit，防止切走时 0 尺寸破坏终端状态
        const container = wrapperRef.current
        if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return
        safeFit(s.fitAddon)
        const dims = getProposedDimensions(s.fitAddon)
        if (dims && s.ws?.readyState === WebSocket.OPEN) {
          s.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
        }
      })
    }
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(wrapper)

    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const s = getSession(paneId)
          if (!s) return
          stabilizeTerminalLayout(s)
        }
      }
    })
    intersectionObserver.observe(wrapper)

    return () => {
      cancelAnimationFrame(resizeRafId)
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
  }, [applyPerformanceMode, connection, connectWs, getProposedDimensions, paneId, profileId, safeFit, stabilizeTerminalLayout, updateCellHeight])

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
      ;(s.term.options as typeof s.term.options & { fontLigatures?: boolean }).fontLigatures = settings.fontLigatures
      applyPerformanceMode(s, settings.termHighPerformance)
      s.containerEl.style.backgroundColor = r.theme.background ?? ''
      setIsDarkMode(isDark)
      const preferredFont = r.fontFamily.split(',')[0]?.trim()
      stabilizeTerminalLayout(s, preferredFont)
      safeFit(s.fitAddon)
      setTimeout(updateCellHeight, 50)
    }

    const unsub1 = useTerminalProfileStore.subscribe(applyProfile)
    const unsubTheme = useThemeStore.subscribe(applyProfile)
    // 只监听终端相关设置字段变化
    const unsub2 = useSettingsStore.subscribe((s, prev) => {
      if (
        s.activeProfileId !== prev.activeProfileId ||
        s.termThemeLight !== prev.termThemeLight ||
        s.termThemeDark !== prev.termThemeDark ||
        s.fontLigatures !== prev.fontLigatures ||
        s.termFontFamily !== prev.termFontFamily ||
        s.termFontSize !== prev.termFontSize ||
        s.termLineHeight !== prev.termLineHeight ||
        s.termLetterSpacing !== prev.termLetterSpacing ||
        s.termScrollback !== prev.termScrollback ||
        s.termCursorStyle !== prev.termCursorStyle ||
        s.termCursorBlink !== prev.termCursorBlink ||
        s.termHighPerformance !== prev.termHighPerformance ||
        s.termStripeEnabled !== prev.termStripeEnabled
      ) {
        applyProfile()
      }
    })
    const observer = new MutationObserver(applyProfile)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    return () => { unsub1(); unsubTheme(); unsub2(); observer.disconnect() }
  }, [applyPerformanceMode, paneId, profileId, safeFit, stabilizeTerminalLayout, updateCellHeight])

  // 鼠标选中自动复制
  useEffect(() => {
    const s = getSession(paneId)
    if (!s) return
    const disposable = s.term.onSelectionChange(() => {
      const { termSelectAutoCopy } = useSettingsStore.getState()
      if (!termSelectAutoCopy) return
      const cur = getSession(paneId)
      const sel = cur?.term.getSelection()
      if (sel) navigator.clipboard.writeText(sel).catch(() => {})
    })
    return () => disposable.dispose()
  }, [paneId])

  // Ctrl+V 粘贴 / Ctrl+Shift+C 复制 / Ctrl+Shift+V 粘贴
  useEffect(() => {
    const s = getSession(paneId)
    if (!s) return

    // xterm 层：仅阻止 xterm 处理这些快捷键（return false），实际操作在 wrapper handler 中
    s.term.attachCustomKeyEventHandler((e) => {
      // 调试模式下放行 F12（不让 xterm 吞掉）
      if (e.key === 'F12' && useSettingsStore.getState().debugMode) return false
      // P6-3: Tab 键接受命令提示
      if (e.key === 'Tab' && e.type === 'keydown' && hintRef.current) {
        e.preventDefault()
        const text = hintRef.current
        hintRef.current = ''
        setHintText('')
        const cur = getSession(paneId)
        if (cur?.ws?.readyState === WebSocket.OPEN) {
          cur.ws.send(JSON.stringify({ type: 'input', data: text }))
        }
        if (cur) cur.commandBuffer += text
        return false
      }
      // 阻止 xterm 处理 Ctrl+Shift+C/V
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.key === 'V' || e.key === 'v') && e.type === 'keydown') {
        return false
      }
      // 阻止 xterm 处理 Ctrl+V（设置开关）
      const { termCtrlVPaste } = useSettingsStore.getState()
      if (termCtrlVPaste && e.ctrlKey && !e.shiftKey && e.key === 'v' && e.type === 'keydown') {
        return false
      }
      return true
    })
  }, [paneId])

  // 终端内快捷键：复制/粘贴 + 阻止冒泡（防止全局 DevTools 拦截）
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    /** 可靠的剪贴板写入：优先 navigator.clipboard，降级 execCommand */
    const writeClipboard = (text: string) => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => execCommandCopy(text))
      } else {
        execCommandCopy(text)
      }
    }
    const execCommandCopy = (text: string) => {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;opacity:0;left:-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }

    /** 剪贴板读取并发送到终端 */
    const pasteToTerminal = () => {
      navigator.clipboard.readText().then((text) => {
        const cur = getSession(paneId)
        if (text && cur?.ws?.readyState === WebSocket.OPEN) {
          cur.ws.send(JSON.stringify({ type: 'input', data: text }))
        }
      }).catch(() => {})
    }

    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+C — 复制
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault()
        e.stopPropagation()
        const cur = getSession(paneId)
        const sel = cur?.term.getSelection()
        if (sel) writeClipboard(sel)
        return
      }
      // Ctrl+Shift+V — 粘贴
      if (e.ctrlKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault()
        e.stopPropagation()
        pasteToTerminal()
        return
      }
      // Ctrl+V — 粘贴（设置开关）
      if (e.ctrlKey && !e.shiftKey && (e.key === 'v' || e.key === 'V') && !e.shiftKey) {
        const { termCtrlVPaste } = useSettingsStore.getState()
        if (termCtrlVPaste) {
          e.preventDefault()
          e.stopPropagation()
          pasteToTerminal()
        }
      }
    }
    wrapper.addEventListener('keydown', handler, true)  // capture phase 确保最先执行
    return () => wrapper.removeEventListener('keydown', handler, true)
  }, [paneId])

  // 鼠标中键操作（none/copy/paste/menu/copy-paste）
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const copySelection = () => {
      const s = getSession(paneId)
      const sel = s?.term.getSelection()
      if (sel) navigator.clipboard.writeText(sel).catch(() => {})
    }
    const pasteClipboard = () => {
      navigator.clipboard.readText().then((text) => {
        const s = getSession(paneId)
        if (text && s?.ws?.readyState === WebSocket.OPEN) {
          s.ws.send(JSON.stringify({ type: 'input', data: text }))
        }
      }).catch(() => {})
    }

    const handler = (e: MouseEvent) => {
      if (e.button !== 1) return // 仅中键
      const action = useSettingsStore.getState().termMiddleClickAction
      if (action === 'none') return
      e.preventDefault()
      if (action === 'copy') {
        copySelection()
      } else if (action === 'paste') {
        pasteClipboard()
      } else if (action === 'menu') {
        const hasSelection = !!getSession(paneId)?.term.getSelection()
        onContextMenu?.(e.clientX, e.clientY, hasSelection)
      } else if (action === 'copy-paste') {
        const s = getSession(paneId)
        const sel = s?.term.getSelection()
        if (sel) {
          navigator.clipboard.writeText(sel).catch(() => {})
        } else {
          pasteClipboard()
        }
      }
    }
    wrapper.addEventListener('mousedown', handler)
    return () => wrapper.removeEventListener('mousedown', handler)
  }, [paneId, onContextMenu])

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
          s.termHighlightRules !== prev.termHighlightRules) {
        pushConfig()
      }
    })
    return () => { unsub1(); unsub2() }
  }, [sendHighlightConfig])

  // P6-2: 命令历史记录 — 通过 inputListener 追踪输入缓冲区，Enter 时记录到后端
  useEffect(() => {
    if (!connectionId) return

    const listener = (data: string) => {
      const session = getSession(paneId)
      if (!session) return

      if (data === '\r') {
        const cmd = session.commandBuffer.trim()
        if (cmd && useSettingsStore.getState().sshHistoryEnabled && cmd !== session.lastRecordedCommand) {
          session.lastRecordedCommand = cmd
          addHistory(connectionId, cmd).catch(() => {})
          // 同步到缓存（去重，置顶）
          const idx = session.historyCache.indexOf(cmd)
          if (idx !== -1) session.historyCache.splice(idx, 1)
          session.historyCache.unshift(cmd)
        }
        session.commandBuffer = ''
      } else if (data === '\x7f' || data === '\b') {
        session.commandBuffer = session.commandBuffer.slice(0, -1)
      } else if (data === '\x03' || data === '\x04') {
        session.commandBuffer = ''
      } else if (data.startsWith('\x1b')) {
        // 方向键等转义序列 — 清空缓冲区（无法追踪 shell 内部状态）
        session.commandBuffer = ''
      } else {
        session.commandBuffer += data
      }
    }

    addInputListener(paneId, listener)
    return () => removeInputListener(paneId, listener)
  }, [paneId, connectionId])

  // P6-2: 加载历史命令缓存（连接建立后）
  useEffect(() => {
    if (!connectionId) return
    const loadCount = useSettingsStore.getState().sshHistoryLoadCount || 100
    getHistory(connectionId, loadCount)
      .then(history => {
        const session = getSession(paneId)
        if (session) session.historyCache = history.map(h => h.command)
      })
      .catch(() => {})
  }, [paneId, connectionId])

  // P6-3: 命令提示 — 基于输入缓冲区前缀匹配历史命令
  const termCommandHint = useSettingsStore((s) => s.termCommandHint)
  const sshHistoryEnabled = useSettingsStore((s) => s.sshHistoryEnabled)

  useEffect(() => {
    if (!termCommandHint || !sshHistoryEnabled) {
      hintRef.current = ''
      return
    }

    let rafId = 0
    const listener = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const session = getSession(paneId)
        if (!session || session.commandBuffer.length < 2) {
          if (hintRef.current) { hintRef.current = ''; setHintText('') }
          return
        }
        const buf = session.commandBuffer
        const match = session.historyCache.find(cmd => cmd.startsWith(buf) && cmd !== buf)
        const suffix = match ? match.slice(buf.length) : ''
        if (suffix !== hintRef.current) {
          hintRef.current = suffix
          setHintText(suffix)
        }
      })
    }

    addInputListener(paneId, listener)
    return () => { removeInputListener(paneId, listener); cancelAnimationFrame(rafId) }
  }, [paneId, termCommandHint, sshHistoryEnabled])

  // P6-3: Tab 键接受提示 — 已合并到 customKeyEventHandler 中

  const termStripeEnabled = useSettingsStore((s) => s.termStripeEnabled)
  const fallbackStripeHeight = useSettingsStore((s) => Math.max(1, Math.round((s.termFontSize || 14) * (s.termLineHeight || 1))))
  const displayedHint = termCommandHint && sshHistoryEnabled ? hintText : ''
  const stripeHeight = cellHeight > 0
    ? cellHeight
    : fallbackStripeHeight
  const stripeBackgroundImage = termStripeEnabled
    ? `repeating-linear-gradient(to bottom,
      transparent 0px, transparent ${stripeHeight}px,
      ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)'} ${stripeHeight}px,
      ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)'} ${stripeHeight * 2}px)`
    : undefined

  return (
    <div className="w-full h-full relative">
      <div
        ref={wrapperRef}
        className="w-full h-full terminal-container transition-colors duration-300"
        onContextMenu={(e) => {
          e.preventDefault()
          const action = useSettingsStore.getState().termRightClickAction
          if (action === 'none') return
          if (action === 'copy') {
            const sel = getSession(paneId)?.term.getSelection()
            if (sel) navigator.clipboard.writeText(sel).catch(() => {})
          } else if (action === 'paste') {
            navigator.clipboard.readText().then((text) => {
              const s = getSession(paneId)
              if (text && s?.ws?.readyState === WebSocket.OPEN) {
                s.ws.send(JSON.stringify({ type: 'input', data: text }))
              }
            }).catch(() => {})
          } else if (action === 'copy-paste') {
            const sel = getSession(paneId)?.term.getSelection()
            if (sel) {
              navigator.clipboard.writeText(sel).catch(() => {})
            } else {
              navigator.clipboard.readText().then((text) => {
                const s = getSession(paneId)
                if (text && s?.ws?.readyState === WebSocket.OPEN) {
                  s.ws.send(JSON.stringify({ type: 'input', data: text }))
                }
              }).catch(() => {})
            }
          } else {
            // menu 模式（默认）
            const hasSelection = !!getSession(paneId)?.term.getSelection()
            onContextMenu?.(e.clientX, e.clientY, hasSelection)
          }
        }}
      />
      {/* 条纹覆盖层：pointer-events: none 不影响终端交互/选择 */}
      {stripeBackgroundImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: stripeBackgroundImage }}
        />
      )}
      {/* P6-3: 命令提示浮层 */}
      {displayedHint && (
        <div
          className="absolute bottom-2 right-2 bg-bg-card/90 border border-border rounded-lg px-3 py-1.5 text-[12px] backdrop-blur-sm z-10 flex items-center gap-2 cursor-pointer select-none"
          onClick={() => {
            const session = getSession(paneId)
            if (!session) return
            const text = hintRef.current
            hintRef.current = ''
            setHintText('')
            if (session.ws?.readyState === WebSocket.OPEN) {
              session.ws.send(JSON.stringify({ type: 'input', data: text }))
            }
            session.commandBuffer += text
            session.term.focus()
          }}
        >
          <kbd className="px-1 py-0.5 rounded bg-bg-subtle border border-border text-[10px] text-text-3 font-mono">Tab</kbd>
          <span className="text-text-1 font-mono truncate max-w-[300px]">{displayedHint}</span>
        </div>
      )}
    </div>
  )
}

