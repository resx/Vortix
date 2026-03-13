/* ── SFTP 路径导航栏 ── */

import { useState, useRef, useEffect, useCallback } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpBookmarkStore } from '../../../stores/useSftpBookmarkStore'
import SftpBookmarkPopover from './SftpBookmarkPopover'
import SftpHistoryPopover from './SftpHistoryPopover'

interface Props {
  onNavigate: (path: string) => void
}

export default function SftpPathBar({ onNavigate }: Props) {
  const currentPath = useSftpStore(s => s.currentPath)
  const historyIndex = useSftpStore(s => s.historyIndex)
  const pathHistory = useSftpStore(s => s.pathHistory)
  const goBack = useSftpStore(s => s.goBack)
  const goForward = useSftpStore(s => s.goForward)
  const goUp = useSftpStore(s => s.goUp)
  const goHome = useSftpStore(s => s.goHome)

  const isBookmarked = useSftpBookmarkStore(s => s.has(currentPath))
  const toggleBookmark = useSftpBookmarkStore(s => s.toggle)

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const segments = currentPath.split('/').filter(Boolean)

  const handleSubmit = () => {
    setEditing(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== currentPath) {
      onNavigate(trimmed.startsWith('/') ? trimmed : '/' + trimmed)
    }
  }

  const handleBreadcrumbClick = (index: number) => {
    const path = '/' + segments.slice(0, index + 1).join('/')
    onNavigate(path)
  }

  const closePopovers = useCallback(() => {
    setShowBookmarks(false)
    setShowHistory(false)
  }, [])

  return (
    <div className="relative h-[32px] flex items-center gap-1 px-2 border-b border-border bg-bg-subtle shrink-0">
      <button
        className="p-0.5 rounded text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors disabled:opacity-30"
        disabled={historyIndex <= 0}
        onClick={() => { goBack(); onNavigate(pathHistory[historyIndex - 1]) }}
        title="后退"
      >
        <AppIcon icon={icons.arrowLeft} size={13} />
      </button>
      <button
        className="p-0.5 rounded text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors disabled:opacity-30"
        disabled={historyIndex >= pathHistory.length - 1}
        onClick={() => { goForward(); onNavigate(pathHistory[historyIndex + 1]) }}
        title="前进"
      >
        <AppIcon icon={icons.arrowRight} size={13} />
      </button>
      <button
        className="p-0.5 rounded text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors"
        onClick={() => { goUp(); }}
        title="上级目录"
      >
        <AppIcon icon={icons.chevronUp} size={13} />
      </button>
      <button
        className="p-0.5 rounded text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors"
        onClick={() => { goHome(); }}
        title="主目录"
      >
        <AppIcon icon={icons.home} size={13} />
      </button>

      {/* 历史 */}
      <button
        className={`p-0.5 rounded transition-colors ${showHistory ? 'text-primary bg-primary/10' : 'text-text-3 hover:text-text-1 hover:bg-bg-hover'}`}
        onClick={() => { setShowHistory(!showHistory); setShowBookmarks(false) }}
        title="历史路径"
      >
        <AppIcon icon={icons.history} size={13} />
      </button>

      {/* 收藏星标 */}
      <button
        className={`p-0.5 rounded transition-colors ${isBookmarked ? 'text-primary' : 'text-text-3 hover:text-text-1'} hover:bg-bg-hover`}
        onClick={() => toggleBookmark(currentPath)}
        title={isBookmarked ? '取消收藏' : '收藏当前路径'}
      >
        <AppIcon icon={icons.pin} size={13} />
      </button>

      {/* 收藏列表 */}
      <button
        className={`p-0.5 rounded transition-colors ${showBookmarks ? 'text-primary bg-primary/10' : 'text-text-3 hover:text-text-1 hover:bg-bg-hover'}`}
        onClick={() => { setShowBookmarks(!showBookmarks); setShowHistory(false) }}
        title="收藏列表"
      >
        <AppIcon icon={icons.list} size={13} />
      </button>

      <div className="flex-1 min-w-0 ml-1">
        {editing ? (
          <input
            ref={inputRef}
            className="w-full h-[22px] px-1.5 text-[11px] font-mono bg-bg-card border border-primary/50 rounded text-text-1 outline-none"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSubmit()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <div
            className="flex items-center gap-0.5 text-[11px] font-mono text-text-3 truncate cursor-pointer hover:text-text-1 transition-colors"
            onClick={() => { setEditing(true); setEditValue(currentPath) }}
            title={currentPath}
          >
            <span
              className="hover:text-primary cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onNavigate('/') }}
            >/</span>
            {segments.map((seg, i) => (
              <span key={i} className="flex items-center gap-0.5">
                <span
                  className="hover:text-primary cursor-pointer truncate max-w-[80px]"
                  onClick={(e) => { e.stopPropagation(); handleBreadcrumbClick(i) }}
                  title={seg}
                >{seg}</span>
                {i < segments.length - 1 && <span className="text-text-3/50">/</span>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 弹窗 */}
      {showBookmarks && <SftpBookmarkPopover onNavigate={onNavigate} onClose={closePopovers} />}
      {showHistory && <SftpHistoryPopover onNavigate={onNavigate} onClose={closePopovers} />}
    </div>
  )
}
