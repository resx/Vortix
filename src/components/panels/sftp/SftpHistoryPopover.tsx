/* ── SFTP 历史路径弹窗 ── */

import { useRef, useEffect } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpBookmarkStore } from '../../../stores/useSftpBookmarkStore'

function getRecentUniquePaths(paths: string[], limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (let i = paths.length - 1; i >= 0 && result.length < limit; i--) {
    const p = paths[i]
    if (seen.has(p)) continue
    seen.add(p)
    result.push(p)
  }
  return result
}

interface Props {
  onNavigate: (path: string) => void
  onClose: () => void
}

export default function SftpHistoryPopover({ onNavigate, onClose }: Props) {
  const pathHistory = useSftpStore(s => s.pathHistory)
  const currentPath = useSftpStore(s => s.currentPath)
  const removeHistoryPath = useSftpStore(s => s.removeHistoryPath)
  const clearHistory = useSftpStore(s => s.clearHistory)
  const hasBookmark = useSftpBookmarkStore(s => s.has)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // 去重，保留最近 50 条，按最近优先
  const unique = getRecentUniquePaths(pathHistory, 50)

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 w-[260px] max-h-[280px] overflow-y-auto rounded-xl border border-border bg-bg-card shadow-lg py-1"
    >
      <div className="px-3 py-1.5 text-[11px] font-medium text-text-3 flex items-center justify-between">
        <span>历史路径</span>
        {unique.length > 0 && (
          <button
            className="text-[10px] text-text-3 hover:text-status-error transition-colors"
            onClick={() => clearHistory()}
          >
            清空
          </button>
        )}
      </div>
      {unique.length === 0 && (
        <div className="px-3 py-4 text-[11px] text-text-3 text-center">暂无历史</div>
      )}
      {unique.map(p => {
        const isCurrent = p === currentPath
        const isBookmarked = hasBookmark(p)
        const label = p.split('/').filter(Boolean).pop() || '/'
        return (
          <div
            key={p}
            className={`flex items-center gap-2 px-3 h-[30px] cursor-pointer group ${isCurrent ? 'bg-primary/8 text-primary' : 'hover:bg-bg-hover text-text-1'}`}
            onClick={() => { onNavigate(p); onClose() }}
            title={p}
          >
            {isBookmarked ? (
              <AppIcon icon={icons.pin} size={12} className="text-primary shrink-0" />
            ) : (
              <AppIcon icon={icons.history} size={12} className="text-text-3 shrink-0" />
            )}
            <span className="text-[11px] truncate flex-1">{label}</span>
            <span className="text-[10px] text-text-3 truncate max-w-[120px]">{p}</span>
            {!isCurrent && (
              <button
                className="p-0.5 rounded text-text-3 hover:text-status-error opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                onClick={(e) => { e.stopPropagation(); removeHistoryPath(p) }}
                title="从历史中删除"
              >
                <AppIcon icon={icons.trash} size={10} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
