import { useState, useEffect, useRef, useCallback } from 'react'
import type { AssetRow } from '../../types'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'

interface Props {
  asset: AssetRow
  onExit: () => void
  setConnected: () => void
}

export default function TerminalSimulation({ asset, onExit, setConnected }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [connected, setConnectedState] = useState(false)
  const [shellStack, setShellStack] = useState<string[]>(['bash'])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const showContextMenu = useAppStore((s) => s.showContextMenu)
  const baseFontSize = useSettingsStore((s) => s.termFontSize)
  const termLineHeight = useSettingsStore((s) => s.termLineHeight)
  const zoomEnabled = useSettingsStore((s) => s.termZoomEnabled)
  const [zoomLevel, setZoomLevel] = useState(1)

  const effectiveFontSize = Math.round(baseFontSize * zoomLevel)
  const lineHeight = Math.round(effectiveFontSize * termLineHeight)

  // Ctrl+滚轮缩放
  useEffect(() => {
    const el = containerRef.current
    if (!el || !zoomEnabled) return
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoomLevel(prev => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        return Math.max(0.5, Math.min(3, +(prev + delta).toFixed(1)))
      })
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [zoomEnabled])

  // 模拟连接
  useEffect(() => {
    const timer = setTimeout(() => {
      setLines([
        `Connecting to ${asset.host}...`,
        `Connected to ${asset.name} (${asset.host}) as ${asset.user}`,
        `Last login: Mon Mar  2 10:30:00 2026 from 192.168.1.100`,
        '',
      ])
      setConnectedState(true)
      setConnected()
    }, 1200)
    return () => clearTimeout(timer)
  }, [asset, setConnected])

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines])

  const currentShell = shellStack[shellStack.length - 1]
  const prompt = `${asset.user}@${asset.name}:~${shellStack.length > 1 ? `(${currentShell})` : ''}$ `

  const handleCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim()
    const newLines = [...lines, `${prompt}${cmd}`]

    if (trimmed === 'exit') {
      if (shellStack.length > 1) {
        setShellStack(s => s.slice(0, -1))
        newLines.push(`exit`)
      } else {
        newLines.push('Connection closed.')
        setLines(newLines)
        onExit()
        return
      }
    } else if (['su', 'bash', 'zsh', 'sh'].includes(trimmed)) {
      setShellStack(s => [...s, trimmed])
      newLines.push(`Entering ${trimmed} shell...`)
    } else if (trimmed === 'whoami') {
      newLines.push(asset.user)
    } else if (trimmed === 'hostname') {
      newLines.push(asset.name)
    } else if (trimmed === 'pwd') {
      newLines.push(`/home/${asset.user}`)
    } else if (trimmed === 'ls') {
      newLines.push('.bashrc  .profile  .ssh  documents  projects')
    } else if (trimmed === 'uname -a') {
      newLines.push('Linux ' + asset.name + ' 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux')
    } else if (trimmed === 'clear') {
      setLines([])
      setInput('')
      return
    } else if (trimmed === '') {
      // 空命令
    } else {
      newLines.push(`${trimmed}: command not found`)
    }

    setLines(newLines)
    setInput('')
  }, [lines, prompt, shellStack, asset, onExit])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(input)
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 font-mono px-4 overflow-auto custom-scrollbar cursor-text"
      style={{
        fontSize: `${effectiveFontSize}px`,
        lineHeight: `${lineHeight}px`,
        backgroundColor: 'var(--term-bg)',
        color: 'var(--term-text)',
        caretColor: 'var(--term-caret)',
      }}
      onClick={() => inputRef.current?.focus()}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const selection = window.getSelection()?.toString()
        showContextMenu(e.clientX, e.clientY, 'terminal', {
          tabId: asset.id,
          hasSelection: !!selection,
        })
      }}
    >
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap break-all" style={{ backgroundColor: 'transparent' }}>{line}</div>
      ))}
      {connected && (
        <div className="flex">
          <span className="whitespace-pre" style={{ color: 'var(--term-prompt)' }}>{prompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none font-mono"
            style={{ fontSize: 'inherit', color: 'var(--term-text)', caretColor: 'var(--term-caret)' }}
            autoFocus
            spellCheck={false}
          />
        </div>
      )}
      {!connected && (
        <div className="flex items-center gap-2 text-text-3">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          正在连接...
        </div>
      )}
    </div>
  )
}
