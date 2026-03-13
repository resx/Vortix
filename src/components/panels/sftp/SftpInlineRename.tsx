/* ── SFTP 内联重命名 ── */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSftpStore } from '../../../stores/useSftpStore'

interface Props {
  name: string
  path: string
  onRename: (oldPath: string, newName: string) => void
}

export default function SftpInlineRename({ name, path, onRename }: Props) {
  const [value, setValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)
  const setRenamingPath = useSftpStore(s => s.setRenamingPath)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      // 选中文件名（不含扩展名）
      const dotIdx = name.lastIndexOf('.')
      inputRef.current.setSelectionRange(0, dotIdx > 0 ? dotIdx : name.length)
    }
  }, [name])

  const submit = useCallback(() => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== name) {
      onRename(path, trimmed)
    }
    setRenamingPath(null)
  }, [value, name, path, onRename, setRenamingPath])

  return (
    <input
      ref={inputRef}
      className="flex-1 min-w-0 h-[20px] px-1 text-[12px] bg-bg-card border border-primary/50 rounded text-text-1 outline-none"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={e => {
        if (e.key === 'Enter') submit()
        if (e.key === 'Escape') setRenamingPath(null)
        e.stopPropagation()
      }}
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
    />
  )
}
