import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
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
  /** 连接状态回调 */
  onStatusChange?: (status: 'connecting' | 'connected' | 'closed' | 'error') => void
}

export default function SshTerminal({ wsUrl = 'ws://localhost:3001/ws/ssh', connection, onStatusChange }: SshTerminalProps) {
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

    // 初始化 xterm
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
      theme: {
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
      },
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

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ padding: '4px', backgroundColor: '#1E1E2E' }}
    />
  )
}
