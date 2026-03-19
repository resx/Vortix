/* ── SFTP 状态栏（岛屿风格版） ── */

import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useTransferStore } from '../../../stores/useTransferStore'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
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
  const totalSize = visibleEntries.reduce((sum, e) => sum + (e.size >= 0 ? e.size : 0), 0)

  const activeTasks = tasks.filter(t => t.status === 'active' || t.status === 'queued')
  const activeTask = tasks.find(t => t.status === 'active')
  const progress = activeTask && activeTask.fileSize > 0
    ? Math.round((activeTask.bytesTransferred / activeTask.fileSize) * 100)
    : 0

  return (
    <div className="text-center py-2 text-[12px] text-text-3 border-b border-border-subtle bg-bg-subtle/30 shrink-0">
      <div className="flex items-center justify-center gap-1.5 relative px-4">
        <span>共 {files} 个文件，{dirs} 个文件夹，{formatSize(totalSize)}</span>
        {selectedCount > 0 && (
          <span className="text-primary font-medium ml-1">（已选 {selectedCount} 项）</span>
        )}
        
        {/* 传输进度胶囊 */}
        {activeTasks.length > 0 && (
          <div className="absolute right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            <AppIcon icon={icons.loader} size={10} className="animate-spin" />
            <span className="text-[10px] font-semibold whitespace-nowrap">
              {activeTasks.length} 传输中 {progress}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
