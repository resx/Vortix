/* ── SFTP 状态栏 ── */

import { useSftpStore } from '../../../stores/useSftpStore'

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

  const visibleEntries = showHidden ? entries : entries.filter(e => !e.name.startsWith('.'))
  const dirs = visibleEntries.filter(e => e.type === 'dir').length
  const files = visibleEntries.filter(e => e.type !== 'dir').length
  const selectedCount = selectedPaths.size
  const selectedSize = entries
    .filter(e => selectedPaths.has(e.path) && e.type !== 'dir')
    .reduce((sum, e) => sum + e.size, 0)

  return (
    <div className="h-[24px] flex items-center justify-between px-3 border-t border-border bg-bg-subtle shrink-0 text-[10px] text-text-3">
      <span>{dirs} 个目录, {files} 个文件</span>
      {selectedCount > 0 && (
        <span>已选 {selectedCount} 项{selectedSize > 0 ? ` (${formatSize(selectedSize)})` : ''}</span>
      )}
    </div>
  )
}
