import { useState, useEffect, useRef, useCallback } from 'react'
import type { AssetRow } from '../../types'

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
      className="flex-1 bg-[#1E1E1E] text-[#D4D4D4] font-mono text-[13px] p-4 overflow-auto custom-scrollbar cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {lines.map((line, i) => (
        <div key={i} className="leading-6 whitespace-pre-wrap">{line}</div>
      ))}
      {connected && (
        <div className="flex leading-6">
          <span className="text-[#6A9955] whitespace-pre">{prompt}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-[#D4D4D4] font-mono text-[13px] caret-[#D4D4D4]"
            autoFocus
            spellCheck={false}
          />
        </div>
      )}
      {!connected && (
        <div className="flex items-center gap-2 text-[#86909C]">
          <div className="w-3 h-3 border-2 border-[#4080FF] border-t-transparent rounded-full animate-spin" />
          正在连接...
        </div>
      )}
    </div>
  )
}
