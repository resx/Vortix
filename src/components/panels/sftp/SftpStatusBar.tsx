/* ── SFTP 状态栏 ── */

import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useTransferStore } from '../../../stores/useTransferStore'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
}

export default function SftpStatusBar() {
  const entries = useSftpStore(s => s.entries)
  const selectedPaths = useSftpStore(s => s.selectedPaths)
  const showHidden = useSftpStore(s => s.showHidden)
  const tasks = useTransferStore(s => s.tasks)

  const visibleEntries = entries.filter(e =>
    e.name !== '.' && e.name !== '..' && (showHidden || !e.name.startsWith('.'))
  )
  const dirs = visibleEntries.filter(e => e.type === 'dir').length
  const files = visibleEntries.filter(e => e.type !== 'dir').length
  const selectedCount = selectedPaths.size
  const selectedSize = entries
    .filter(e => selectedPaths.has(e.path) && e.type !== 'dir')
    .reduce((sum, e) => sum + e.size, 0)

  const activeTasks = tasks.filter(t => t.status === 'active' || t.status === 'queued')
  const activeTask = tasks.find(t => t.status === 'active')
  const progress = activeTask && activeTask.fileSize > 0
    ? Math.round((activeTask.bytesTransferred / activeTask.fileSize) * 100)
    : 0

  return (
    <div className="h-[24px] flex items-center justify-between px-3 border-t border-border bg-bg-subtle shrink-0 text-[10px] text-text-3 gap-2">
      <span className="truncate">{dirs} 个目录, {files} 个文件</span>

      <div className="flex items-center gap-2 shrink-0">
        {/* 传输进度胶囊 */}
        {activeTasks.length > 0 && (
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
            <AppIcon icon={icons.loader} size={10} />
            <span className="text-[10px] font-medium">
              {activeTasks.length} 传输中
              {activeTask && ` ${progress}%`}
            </span>
            {activeTask && activeTask.speed > 0 && (
              <span className="text-[9px] opacity-70">{formatSpeed(activeTask.speed)}</span>
            )}
          </div>
        )}

        {selectedCount > 0 && (
          <span>已选 {selectedCount} 项{selectedSize > 0 ? ` (${formatSize(selectedSize)})` : ''}</span>
        )}
      </div>
    </div>
  )
}
