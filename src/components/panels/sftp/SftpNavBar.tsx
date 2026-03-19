/* ── SFTP 导航栏（岛屿风格升级版） ── */

import { useState, useRef, useEffect, useCallback } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpBookmarkStore } from '../../../stores/useSftpBookmarkStore'
import SftpHistoryPopover from './SftpHistoryPopover'

interface Props {
  onNavigate: (path: string) => void
  onRefresh: () => void
  /** 仅刷新文件列表，不修改历史（用于后退/前进） */
  onListDir: (path: string) => void
  /** 同步路径到 SSH 终端 */
  onSyncTerminal?: (path: string) => void
}

/** 辅助函数：从路径历史中获取去重且截断的列表 */
function getRecentUniquePaths(history: string[], limit: number) {
  const seen = new Set<string>()
  const result: string[] = []
  for (let i = history.length - 1; i >= 0; i--) {
    if (!seen.has(history[i])) {
      seen.add(history[i])
      result.push(history[i])
    }
    if (result.length >= limit) break
  }
  return result
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
      className="absolute top-full right-0 mt-2 z-50 min-w-[180px] rounded-xl glass-context py-1 shadow-lg border border-border-subtle overflow-hidden"
    >
      <label className="flex items-center gap-2.5 px-3 h-[32px] hover:bg-bg-active cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-primary w-3.5 h-3.5"
          checked={showHidden}
          onChange={e => setShowHidden(e.target.checked)}
        />
        <span className="text-[12px] text-text-1">显示隐藏文件</span>
      </label>
      <label className="flex items-center gap-2.5 px-3 h-[32px] hover:bg-bg-active cursor-pointer select-none">
        <input
          type="checkbox"
          className="accent-primary w-3.5 h-3.5"
          checked={pathSyncEnabled}
          onChange={e => setPathSyncEnabled(e.target.checked)}
        />
        <span className="text-[12px] text-text-1">路径联动</span>
      </label>
      <div className="h-px bg-border-subtle mx-2 my-0.5" />
      <div
        className="flex items-center gap-2.5 px-3 h-[32px] hover:bg-bg-active cursor-pointer select-none"
        onClick={() => { toggleBookmark(currentPath); onClose() }}
      >
        <AppIcon icon={icons.pin} size={14} className={isBookmarked ? 'text-primary' : 'text-text-3'} />
        <span className="text-[12px] text-text-1">{isBookmarked ? '取消收藏' : '收藏当前路径'}</span>
      </div>
    </div>
  )
}

export default function SftpNavBar({ onNavigate, onRefresh, onListDir, onSyncTerminal }: Props) {
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
    setSearchValue('')
    setSearchQuery('')
  }, [setSearchActive, setSearchQuery])

  const handlePathClick = useCallback(() => {
    setEditing(true)
    setEditValue(currentPath)
    setShowPathDrop(true)
  }, [currentPath])

  // 去重历史路径（用于路径栏下拉）
  const recentPaths = getRecentUniquePaths(pathHistory, 20)

  const btnCls = 'p-1.5 hover:bg-bg-active rounded-lg text-text-2 transition-all active:scale-95 disabled:opacity-30'

  return (
    <div className="flex items-center gap-2 bg-bg-card/80 backdrop-blur border border-border-subtle rounded-2xl shadow-sm mx-3 mt-3 p-1.5 shrink-0 z-20">
      <div className="flex items-center gap-0.5 border-r border-border-subtle pr-1 mr-1">
        {/* 后退 */}
        <button
          className={btnCls}
          disabled={historyIndex <= 0}
          onClick={() => {
            const target = pathHistory[historyIndex - 1]
            goBack()
            onListDir(target)
            onSyncTerminal?.(target)
          }}
          title="后退"
        >
          <AppIcon icon={icons.chevronLeft} size={18} />
        </button>

        {/* 前进 */}
        {historyIndex < pathHistory.length - 1 && (
          <button
            className={btnCls}
            onClick={() => {
              const target = pathHistory[historyIndex + 1]
              goForward()
              onListDir(target)
              onSyncTerminal?.(target)
            }}
            title="前进"
          >
            <AppIcon icon={icons.chevronRight} size={18} />
          </button>
        )}

        {/* 返回上一级 */}
        <button
          className={btnCls}
          onClick={() => {
            const parent = currentPath.replace(/\/[^/]+\/?$/, '') || '/'
            onNavigate(parent)
          }}
          disabled={currentPath === '/'}
          title="返回上一级"
        >
          <AppIcon icon={icons.chevronUp} size={18} />
        </button>

        {/* 刷新 */}
        <button className={btnCls} onClick={onRefresh} title="刷新">
          <AppIcon icon={icons.refresh} size={16} />
        </button>
      </div>

      {/* 路径栏 / 搜索栏 */}
      <div className="flex-1 min-w-0 relative" ref={pathDropRef}>
        {searchActive ? (
          <input
            ref={searchRef}
            className="w-full h-[32px] px-3 text-[13px] font-mono bg-bg-subtle/50 border border-border rounded-xl text-text-1 outline-none placeholder:text-text-3 focus:ring-1 focus:ring-primary/30 transition-all"
            placeholder="搜索当前目录..."
            value={searchValue}
            onChange={e => handleSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') handleSearchClose() }}
          />
        ) : editing ? (
          <input
            ref={inputRef}
            className="w-full h-[32px] px-3 text-[13px] font-mono bg-bg-subtle/50 border border-border rounded-xl text-text-1 outline-none focus:ring-1 focus:ring-primary/30 transition-all"
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
            className="h-[32px] flex items-center px-3 text-[12px] font-mono text-text-2 bg-bg-subtle/40 border border-border-subtle rounded-xl cursor-text hover:border-text-disabled transition-all truncate"
            onClick={handlePathClick}
            title={currentPath}
          >
            {currentPath}
          </div>
        )}

        {/* 路径栏下拉历史 */}
        {showPathDrop && !searchActive && (
          <div
            className="absolute top-full left-0 right-0 mt-2 z-50 max-h-[220px] overflow-y-auto rounded-2xl glass-context py-1 shadow-xl border border-border-subtle"
            onMouseDown={e => e.preventDefault()}
          >
            {recentPaths.map(p => (
              <div
                key={p}
                className={`flex items-center gap-2 px-3 h-[36px] cursor-pointer text-[12px] truncate
                  ${p === currentPath ? 'bg-primary-bg text-primary' : 'hover:bg-bg-hover text-text-2'}`}
                onClick={() => { onNavigate(p); setEditing(false); setShowPathDrop(false) }}
                title={p}
              >
                <AppIcon icon={icons.history} size={12} className="text-text-3 shrink-0" />
                <span className="truncate">{p}</span>
              </div>
            ))}
            {recentPaths.length === 0 && (
              <div className="px-3 py-3 text-[12px] text-text-3 text-center italic">暂无历史</div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {/* 搜索切换 */}
        <button
          className={`${btnCls} ${searchActive ? 'text-primary bg-primary-bg' : ''}`}
          onClick={() => searchActive ? handleSearchClose() : setSearchActive(true)}
          title={searchActive ? '关闭搜索' : '搜索'}
        >
          <AppIcon icon={searchActive ? icons.close : icons.search} size={18} />
        </button>

        {/* 历史路径 */}
        <button
          className={`${btnCls} ${showHistory ? 'text-primary bg-primary-bg' : ''}`}
          onClick={() => { setShowHistory(!showHistory); setShowMore(false) }}
          title="历史路径"
        >
          <AppIcon icon={icons.history} size={18} />
        </button>

        {/* 更多 */}
        <div className="relative">
          <button
            className={`${btnCls} ${showMore ? 'text-primary bg-primary-bg' : ''}`}
            onClick={() => { setShowMore(!showMore); setShowHistory(false) }}
            title="更多选项"
          >
            <AppIcon icon={icons.moreVertical} size={18} />
          </button>
          {showMore && <MoreDropdown onClose={() => setShowMore(false)} />}
        </div>
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
