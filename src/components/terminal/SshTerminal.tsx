import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore } from '../../stores/useSettingsStore'
import '@xterm/xterm/css/xterm.css'

const lightTermTheme = {
  background: '#FFFFFF',
  foreground: '#1F2329',
  cursor: '#1F2329',
  selectionBackground: '#B4D5FE',
  black: '#000000',
  red: '#CD3131',
  green: '#067D17',
  yellow: '#B5890F',
  blue: '#0451A5',
  magenta: '#BC05BC',
  cyan: '#0598BC',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#CD3131',
  brightGreen: '#14CE14',
  brightYellow: '#B5BA1F',
  brightBlue: '#0451A5',
  brightMagenta: '#BC05BC',
  brightCyan: '#0598BC',
  brightWhite: '#A5A5A5',
}

const darkTermTheme = {
  background: '#1E1E2E',
  foreground: '#CDD6F4',
  cursor: '#F5E0DC',
  selectionBackground: '#585B7066',
  black: '#45475A',
  red: '#F38BA8',
  green: '#A6E3A1',
  yellow: '#F9E2AF',
  blue: '#89B4FA',
  magenta: '#F5C2E7',
  cyan: '#94E2D5',
  white: '#BAC2DE',
  brightBlack: '#585B70',
  brightRed: '#F38BA8',
  brightGreen: '#A6E3A1',
  brightYellow: '#F9E2AF',
  brightBlue: '#89B4FA',
  brightMagenta: '#F5C2E7',
  brightCyan: '#94E2D5',
  brightWhite: '#A6ADC8',
}

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
  /** 连接状态回调 */
  onStatusChange?: (status: 'connecting' | 'connected' | 'closed' | 'error') => void
  /** 右键菜单回调 */
  onContextMenu?: (x: number, y: number, hasSelection: boolean) => void
}

export default function SshTerminal({ wsUrl = 'ws://localhost:3001/ws/ssh', connection, onStatusChange, onContextMenu }: SshTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  const cleanup = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    termRef.current?.dispose()
    termRef.current = null
    fitAddonRef.current = null
  }, [])

  useEffect(() => {
    if (!containerRef.current || !connection) return

    cleanup()

    // 根据当前主题选择配色
    const isDark = document.documentElement.classList.contains('dark')
    const termTheme = isDark ? darkTermTheme : lightTermTheme

    // 从 store 读取终端字号
    const termFontSize = useSettingsStore.getState().termFontSize

    // 初始化 xterm
    const term = new Terminal({
      cursorBlink: true,
      fontSize: termFontSize,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      theme: termTheme,
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

    // 建立 WebSocket
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'connect',
        data: connection,
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
            // 连接成功后同步终端尺寸
            const dims = fitAddon.proposeDimensions()
            if (dims) {
              ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
            }
          } else if (msg.data === 'closed') {
            term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m 连接已断开')
            onStatusChange?.('closed')
          }
          break
        case 'error':
          term.writeln('\r\n\x1b[31m[Vortix 错误]\x1b[0m ' + msg.data)
          onStatusChange?.('error')
          break
      }
    }

    ws.onclose = () => {
      term.writeln('\r\n\x1b[33m[Vortix]\x1b[0m WebSocket 已断开')
      onStatusChange?.('closed')
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

    // 窗口 resize
    const handleResize = () => {
      fitAddon.fit()
      const dims = fitAddon.proposeDimensions()
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      cleanup()
    }
  }, [connection, wsUrl, onStatusChange, cleanup])

  // 监听主题变化，动态更新 xterm 主题
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (termRef.current) {
        const isDark = document.documentElement.classList.contains('dark')
        termRef.current.options.theme = isDark ? darkTermTheme : lightTermTheme
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const isDark = document.documentElement.classList.contains('dark')

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ padding: '4px', backgroundColor: isDark ? '#1E1E2E' : '#FFFFFF' }}
      onContextMenu={(e) => {
        e.preventDefault()
        const hasSelection = !!termRef.current?.getSelection()
        onContextMenu?.(e.clientX, e.clientY, hasSelection)
      }}
    />
  )
}
