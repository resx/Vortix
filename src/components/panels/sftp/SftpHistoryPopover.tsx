/* ── SFTP 历史路径弹窗 ── */

import { useRef, useEffect } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpBookmarkStore } from '../../../stores/useSftpBookmarkStore'

interface Props {
  onNavigate: (path: string) => void
  onClose: () => void
}

export default function SftpHistoryPopover({ onNavigate, onClose }: Props) {
  const pathHistory = useSftpStore(s => s.pathHistory)
  const currentPath = useSftpStore(s => s.currentPath)
  const hasBookmark = useSftpBookmarkStore(s => s.has)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // 去重，保留最近 20 条，当前路径排最前
  const unique = [...new Set(pathHistory)].slice(-20).reverse()

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 w-[260px] max-h-[280px] overflow-y-auto rounded-xl border border-border bg-bg-card shadow-lg py-1"
    >
      <div className="px-3 py-1.5 text-[11px] font-medium text-text-3">历史路径</div>
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
          </div>
        )
      })}
    </div>
  )
}
