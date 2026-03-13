/* ── SFTP 导航栏（文件管理器风格） ── */

import { useState, useRef, useEffect, useCallback } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpBookmarkStore } from '../../../stores/useSftpBookmarkStore'
import SftpHistoryPopover from './SftpHistoryPopover'

interface Props {
  onNavigate: (path: string) => void
  onRefresh: () => void
}

/* ── 更多下拉菜单 ── */
function MoreDropdown({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const showHidden = useSftpStore(s => s.showHidden)
  const setShowHidden = useSftpStore(s => s.setShowHidden)
  const pathSyncEnabled = useSftpStore(s => s.pathSyncEnabled)
  const setPathSyncEnabled = useSftpStore(s => s.setPathSyncEnabled)
  const currentPath = useSftpStore(s => s.currentPath)
  const isBookmarked = useSftpBookmarkStore(s => s.has(currentPath))
  const toggleBookmark = useSftpBookmarkStore(s => s.toggle)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-1 z-50 min-w-[180px] rounded-xl glass-context py-1 shadow-lg"
    >
      <label className="flex items-center gap-2.5 px-3 h-[32px] hover:bg-bg-active rounded-lg mx-1 cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-primary w-3.5 h-3.5"
          checked={showHidden}
          onChange={e => setShowHidden(e.target.checked)}
        />
        <span className="text-[12px] text-text-1">显示隐藏文件</span>
      </label>
      <label className="flex items-center gap-2.5 px-3 h-[32px] hover:bg-bg-active rounded-lg mx-1 cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-primary w-3.5 h-3.5"
          checked={pathSyncEnabled}
          onChange={e => setPathSyncEnabled(e.target.checked)}
        />
        <span className="text-[12px] text-text-1">路径联动</span>
      </label>
      <div className="h-px bg-border/60 mx-2 my-0.5" />
      <div
        className="flex items-center gap-2.5 px-3 h-[32px] hover:bg-bg-active rounded-lg mx-1 cursor-pointer select-none"
        onClick={() => { toggleBookmark(currentPath); onClose() }}
      >
        <AppIcon icon={icons.pin} size={14} className={isBookmarked ? 'text-primary' : 'text-text-3'} />
        <span className="text-[12px] text-text-1">{isBookmarked ? '取消收藏' : '收藏当前路径'}</span>
      </div>
    </div>
  )
}

export default function SftpNavBar({ onNavigate, onRefresh }: Props) {
  const currentPath = useSftpStore(s => s.currentPath)
  const historyIndex = useSftpStore(s => s.historyIndex)
  const pathHistory = useSftpStore(s => s.pathHistory)
  const goBack = useSftpStore(s => s.goBack)
  const goForward = useSftpStore(s => s.goForward)
  const searchActive = useSftpStore(s => s.searchActive)
  const setSearchActive = useSftpStore(s => s.setSearchActive)
  const setSearchQuery = useSftpStore(s => s.setSearchQuery)

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [showPathDrop, setShowPathDrop] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showMore, setShowMore] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const pathDropRef = useRef<HTMLDivElement>(null)

  // 编辑模式聚焦
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // 搜索模式聚焦
  useEffect(() => {
    if (searchActive && searchRef.current) {
      searchRef.current.focus()
    }
    if (!searchActive) setSearchValue('')
  }, [searchActive])

  // 点击外部关闭路径下拉
  useEffect(() => {
    if (!showPathDrop) return
    const handler = (e: MouseEvent) => {
      if (pathDropRef.current && !pathDropRef.current.contains(e.target as Node)) {
        setShowPathDrop(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [showPathDrop])

  const handlePathSubmit = useCallback(() => {
    setEditing(false)
    setShowPathDrop(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== currentPath) {
      onNavigate(trimmed.startsWith('/') ? trimmed : '/' + trimmed)
    }
  }, [editValue, currentPath, onNavigate])

  const handleSearchInput = useCallback((val: string) => {
    setSearchValue(val)
    setSearchQuery(val)
  }, [setSearchQuery])

  const handleSearchClose = useCallback(() => {
    setSearchActive(false)
    setSearchQuery('')
  }, [setSearchActive, setSearchQuery])

  const handlePathClick = useCallback(() => {
    setEditing(true)
    setEditValue(currentPath)
    setShowPathDrop(true)
  }, [currentPath])

  // 去重历史路径（用于路径栏下拉）
  const recentPaths = [...new Set(pathHistory)].slice(-15).reverse()

  const btnCls = 'p-1 rounded-md text-text-3 hover:text-text-1 hover:bg-bg-hover transition-colors disabled:opacity-30'

  /* ── JSX ── */
  return (
    <div className="relative h-[38px] flex items-center gap-1 px-2 border-b border-border shrink-0">
      {/* 后退 */}
      <button
        className={btnCls}
        disabled={historyIndex <= 0}
        onClick={() => { goBack(); onNavigate(pathHistory[historyIndex - 1]) }}
        title="后退"
      >
        <AppIcon icon={icons.chevronLeft} size={14} />
      </button>
      {/* 前进 */}
      <button
        className={btnCls}
        disabled={historyIndex >= pathHistory.length - 1}
        onClick={() => { goForward(); onNavigate(pathHistory[historyIndex + 1]) }}
        title="前进"
      >
        <AppIcon icon={icons.chevronRight} size={14} />
      </button>
      {/* 刷新 */}
      <button className={btnCls} onClick={onRefresh} title="刷新">
        <AppIcon icon={icons.refresh} size={14} />
      </button>

      {/* 路径栏 / 搜索栏 */}
      <div className="flex-1 min-w-0 relative" ref={pathDropRef}>
        {searchActive ? (
          <input
            ref={searchRef}
            className="w-full h-[26px] px-2 text-[12px] font-mono bg-bg-card border border-primary/40 rounded-md text-text-1 outline-none placeholder:text-text-3"
            placeholder="搜索当前目录..."
            value={searchValue}
            onChange={e => handleSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') handleSearchClose() }}
          />
        ) : editing ? (
          <input
            ref={inputRef}
            className="w-full h-[26px] px-2 text-[12px] font-mono bg-bg-card border border-primary/40 rounded-md text-text-1 outline-none"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => { handlePathSubmit() }}
            onKeyDown={e => {
              if (e.key === 'Enter') handlePathSubmit()
              if (e.key === 'Escape') { setEditing(false); setShowPathDrop(false) }
            }}
          />
        ) : (
          <div
            className="h-[26px] flex items-center px-2 text-[12px] font-mono text-text-2 bg-bg-subtle rounded-md cursor-pointer hover:bg-bg-hover hover:text-text-1 transition-colors truncate"
            onClick={handlePathClick}
            title={currentPath}
          >
            {currentPath}
          </div>
        )}

        {/* 路径栏下拉历史 */}
        {showPathDrop && !searchActive && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-[220px] overflow-y-auto rounded-xl glass-context py-1 shadow-lg">
            {recentPaths.map(p => (
              <div
                key={p}
                className={`flex items-center gap-2 px-3 h-[28px] cursor-pointer text-[11px] truncate
                  ${p === currentPath ? 'bg-primary/8 text-primary' : 'hover:bg-bg-active text-text-1'}`}
                onClick={() => { onNavigate(p); setEditing(false); setShowPathDrop(false) }}
                title={p}
              >
                <AppIcon icon={icons.history} size={11} className="text-text-3 shrink-0" />
                <span className="truncate">{p}</span>
              </div>
            ))}
            {recentPaths.length === 0 && (
              <div className="px-3 py-3 text-[11px] text-text-3 text-center">暂无历史</div>
            )}
          </div>
        )}
      </div>

      {/* 搜索切换 */}
      <button
        className={`${btnCls} ${searchActive ? 'text-primary bg-primary/10' : ''}`}
        onClick={() => searchActive ? handleSearchClose() : setSearchActive(true)}
        title={searchActive ? '关闭搜索' : '搜索'}
      >
        <AppIcon icon={searchActive ? icons.close : icons.search} size={14} />
      </button>

      {/* 历史路径 */}
      <button
        className={`${btnCls} ${showHistory ? 'text-primary bg-primary/10' : ''}`}
        onClick={() => { setShowHistory(!showHistory); setShowMore(false) }}
        title="历史路径"
      >
        <AppIcon icon={icons.history} size={14} />
      </button>

      {/* 更多 */}
      <div className="relative">
        <button
          className={`${btnCls} ${showMore ? 'text-primary bg-primary/10' : ''}`}
          onClick={() => { setShowMore(!showMore); setShowHistory(false) }}
          title="更多选项"
        >
          <AppIcon icon={icons.moreVertical} size={14} />
        </button>
        {showMore && <MoreDropdown onClose={() => setShowMore(false)} />}
      </div>

      {/* 历史弹窗 */}
      {showHistory && (
        <SftpHistoryPopover
          onNavigate={(p) => { onNavigate(p); setShowHistory(false) }}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
