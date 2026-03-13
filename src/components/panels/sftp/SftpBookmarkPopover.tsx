/* ── SFTP 收藏路径弹窗 ── */

import { useRef, useEffect } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpBookmarkStore } from '../../../stores/useSftpBookmarkStore'

interface Props {
  onNavigate: (path: string) => void
  onClose: () => void
}

export default function SftpBookmarkPopover({ onNavigate, onClose }: Props) {
  const bookmarks = useSftpBookmarkStore(s => s.bookmarks)
  const remove = useSftpBookmarkStore(s => s.remove)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 w-[260px] max-h-[280px] overflow-y-auto rounded-xl border border-border bg-bg-card shadow-lg py-1"
    >
      <div className="px-3 py-1.5 text-[11px] font-medium text-text-3">收藏路径</div>
      {bookmarks.length === 0 && (
        <div className="px-3 py-4 text-[11px] text-text-3 text-center">暂无收藏</div>
      )}
      {bookmarks.map(b => (
        <div
          key={b.path}
          className="flex items-center gap-2 px-3 h-[30px] hover:bg-bg-hover cursor-pointer group"
          onClick={() => { onNavigate(b.path); onClose() }}
          title={b.path}
        >
          <AppIcon icon={icons.pin} size={12} className="text-primary shrink-0" />
          <span className="text-[11px] text-text-1 truncate flex-1">{b.label}</span>
          <span className="text-[10px] text-text-3 truncate max-w-[100px]">{b.path}</span>
          <button
            className="p-0.5 rounded text-text-3 hover:text-status-error opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => { e.stopPropagation(); remove(b.path) }}
            title="取消收藏"
          >
            <AppIcon icon={icons.close} size={10} />
          </button>
        </div>
      ))}
    </div>
  )
}
