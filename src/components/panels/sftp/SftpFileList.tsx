/* ── SFTP 文件列表 ── */

import { useCallback, useRef, useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { getFileTypeIcon } from '../../../lib/file-icons'
import SftpInlineRename from './SftpInlineRename'
import type { SftpFileEntry, SftpSortField } from '../../../types/sftp'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  onNavigate: (path: string) => void
  onContextMenu: (e: React.MouseEvent, entry: SftpFileEntry) => void
  onBlankContextMenu: (e: React.MouseEvent) => void
  onDoubleClick: (entry: SftpFileEntry) => void
  onFileDrop?: (files: File[]) => void
  onRename?: (oldPath: string, newName: string) => void
  onCopy?: () => void
  onCut?: () => void
  onPaste?: () => void
  onDelete?: (path: string, isDir: boolean) => void
  onRenameStart?: (entry: SftpFileEntry) => void
  onRefresh?: () => void
}

export default function SftpFileList({ onNavigate, onContextMenu, onBlankContextMenu, onDoubleClick, onFileDrop, onRename, onCopy, onCut, onPaste, onDelete, onRenameStart, onRefresh }: Props) {
  const entries = useSftpStore(s => s.entries)
  const loading = useSftpStore(s => s.loading)
  const showHidden = useSftpStore(s => s.showHidden)
  const sortField = useSftpStore(s => s.sortField)
  const sortOrder = useSftpStore(s => s.sortOrder)
  const toggleSort = useSftpStore(s => s.toggleSort)
  const selectedPaths = useSftpStore(s => s.selectedPaths)
  const selectPath = useSftpStore(s => s.selectPath)
  const toggleSelect = useSftpStore(s => s.toggleSelect)
  const selectRange = useSftpStore(s => s.selectRange)
  const selectAll = useSftpStore(s => s.selectAll)
  const clearSelection = useSftpStore(s => s.clearSelection)
  const searchQuery = useSftpStore(s => s.searchQuery)
  const renamingPath = useSftpStore(s => s.renamingPath)
  const connected = useSftpStore(s => s.connected)
  const connecting = useSftpStore(s => s.connecting)

  const lastClickRef = useRef<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // 拖入：本地文件拖入 SftpPanel
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // 只在离开容器时取消
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!onFileDrop) return

    const items = e.dataTransfer.items
    if (!items || items.length === 0) return

    // 尝试使用 webkitGetAsEntry 递归读取文件夹
    const entries: FileSystemEntry[] = []
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.()
      if (entry) entries.push(entry)
    }

    if (entries.length > 0) {
      // 递归读取所有文件（含文件夹内文件）
      const readEntry = (entry: FileSystemEntry): Promise<File[]> => {
        if (entry.isFile) {
          return new Promise((resolve) => {
            (entry as FileSystemFileEntry).file(
              (f) => {
                // 保留相对路径信息
                Object.defineProperty(f, 'webkitRelativePath', {
                  value: entry.fullPath.replace(/^\//, ''),
                  writable: false,
                })
                resolve([f])
              },
              () => resolve([]),
            )
          })
        }
        if (entry.isDirectory) {
          return new Promise((resolve) => {
            const reader = (entry as FileSystemDirectoryEntry).createReader()
            const allFiles: File[] = []
            const readBatch = () => {
              reader.readEntries(
                (batch) => {
                  if (batch.length === 0) {
                    resolve(allFiles)
                    return
                  }
                  Promise.all(batch.map(readEntry)).then((results) => {
                    for (const files of results) allFiles.push(...files)
                    readBatch()
                  })
                },
                () => resolve(allFiles),
              )
            }
            readBatch()
          })
        }
        return Promise.resolve([])
      }

      Promise.all(entries.map(readEntry)).then((results) => {
        const files = results.flat()
        if (files.length > 0) onFileDrop(files)
      })
    } else {
      // 回退：直接读取 dataTransfer.files
      const files: File[] = []
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        files.push(e.dataTransfer.files[i])
      }
      if (files.length > 0) onFileDrop(files)
    }
  }, [onFileDrop])

  // 拖出：SftpPanel 文件拖出（设置拖拽数据）
  const handleEntryDragStart = useCallback((e: React.DragEvent, entry: SftpFileEntry) => {
    e.dataTransfer.setData('text/sftp-path', entry.path)
    e.dataTransfer.setData('text/sftp-name', entry.name)
    e.dataTransfer.setData('text/sftp-type', entry.type)
    e.dataTransfer.setData('text/sftp-size', String(entry.size))
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  // 过滤隐藏文件
  const visible = showHidden ? entries : entries.filter(e => !e.name.startsWith('.'))

  // 搜索过滤
  const filtered = searchQuery
    ? visible.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : visible

  // 排序：目录始终在前
  const sorted = [...filtered].sort((a, b) => {
    // 目录优先
    if (a.type === 'dir' && b.type !== 'dir') return -1
    if (a.type !== 'dir' && b.type === 'dir') return 1

    let cmp = 0
    switch (sortField) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'zh-CN')
        break
      case 'size':
        cmp = a.size - b.size
        break
      case 'modifiedAt':
        cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
        break
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })

  const handleClick = useCallback((e: React.MouseEvent, entry: SftpFileEntry) => {
    if (e.ctrlKey || e.metaKey) {
      toggleSelect(entry.path)
    } else if (e.shiftKey && lastClickRef.current) {
      const lastIdx = sorted.findIndex(f => f.path === lastClickRef.current)
      const curIdx = sorted.findIndex(f => f.path === entry.path)
      if (lastIdx >= 0 && curIdx >= 0) {
        const start = Math.min(lastIdx, curIdx)
        const end = Math.max(lastIdx, curIdx)
        selectRange(sorted.slice(start, end + 1).map(f => f.path))
      }
    } else {
      selectPath(entry.path)
    }
    lastClickRef.current = entry.path
  }, [sorted, toggleSelect, selectRange, selectPath])

  const handleDoubleClick = useCallback((entry: SftpFileEntry) => {
    if (entry.type === 'dir') {
      onNavigate(entry.path)
    } else {
      onDoubleClick(entry)
    }
  }, [onNavigate, onDoubleClick])

  /** 键盘快捷键 */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    const key = e.key

    if (ctrl && key === 'c') { e.preventDefault(); onCopy?.(); return }
    if (ctrl && key === 'x') { e.preventDefault(); onCut?.(); return }
    if (ctrl && key === 'v') { e.preventDefault(); onPaste?.(); return }
    if (ctrl && key === 'a') { e.preventDefault(); selectAll(); return }
    if (key === 'F5') { e.preventDefault(); onRefresh?.(); return }
    if (key === 'Escape') { clearSelection(); return }

    // 需要选中项的操作
    const selectedArr = sorted.filter(f => selectedPaths.has(f.path))
    if (key === 'Delete' || key === 'Backspace') {
      if (selectedArr.length === 1) {
        e.preventDefault()
        onDelete?.(selectedArr[0].path, selectedArr[0].type === 'dir')
      }
      return
    }
    if (key === 'F2' && selectedArr.length === 1) {
      e.preventDefault()
      onRenameStart?.(selectedArr[0])
      return
    }
    if (key === 'Enter' && selectedArr.length === 1) {
      e.preventDefault()
      const entry = selectedArr[0]
      if (entry.type === 'dir') onNavigate(entry.path)
      else onDoubleClick(entry)
      return
    }

    // 上下箭头移动选中
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault()
      if (sorted.length === 0) return
      const currentIdx = sorted.findIndex(f => selectedPaths.has(f.path))
      let nextIdx: number
      if (currentIdx < 0) {
        nextIdx = key === 'ArrowDown' ? 0 : sorted.length - 1
      } else {
        nextIdx = key === 'ArrowDown'
          ? Math.min(currentIdx + 1, sorted.length - 1)
          : Math.max(currentIdx - 1, 0)
      }
      selectPath(sorted[nextIdx].path)
      lastClickRef.current = sorted[nextIdx].path
    }
  }, [sorted, selectedPaths, selectAll, clearSelection, selectPath, onCopy, onCut, onPaste, onDelete, onRenameStart, onRefresh, onNavigate, onDoubleClick])

  const renderSortHeader = (field: SftpSortField, label: string, className?: string) => (
    <button
      className={`flex items-center gap-0.5 text-[10px] text-text-3 font-medium hover:text-text-1 transition-colors ${className || ''}`}
      onClick={() => toggleSort(field)}
    >
      {label}
      {sortField === field && (
        <AppIcon icon={sortOrder === 'asc' ? icons.chevronUp : icons.chevronDown} size={10} />
      )}
    </button>
  )

  if (connecting || (!connected && !loading)) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-text-3 gap-2"
        onContextMenu={(e) => e.preventDefault()}
      >
        <AppIcon icon={icons.loader} size={24} className="opacity-40 animate-spin" />
        <span className="text-[12px] opacity-60">正在连接 SFTP...</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-text-3"
        onContextMenu={(e) => e.preventDefault()}
      >
        <AppIcon icon={icons.loader} size={20} className="opacity-50" />
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-text-3"
        onContextMenu={(e) => { e.preventDefault(); onBlankContextMenu(e) }}
      >
        <AppIcon icon={icons.folder} size={32} className="opacity-20 mb-2" />
        <span className="text-[12px]">空目录</span>
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden relative outline-none"
      tabIndex={0}
      onClick={() => clearSelection()}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => { e.preventDefault(); onBlankContextMenu(e) }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽覆盖层 */}
      {dragOver && (
        <div className="absolute inset-0 z-20 bg-primary/10 border-2 border-dashed border-primary/40 rounded-md flex items-center justify-center pointer-events-none">
          <span className="text-[13px] text-primary font-medium">释放以上传</span>
        </div>
      )}
      {/* 列头 */}
      <div className="flex items-center px-3 py-1 border-b border-border/50 bg-bg-subtle/50 shrink-0">
        {renderSortHeader('name', '名称', 'flex-1')}
        {renderSortHeader('size', '大小', 'w-[60px] justify-end')}
        {renderSortHeader('modifiedAt', '修改时间', 'w-[110px] justify-end')}
      </div>

      {/* 文件列表 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {sorted.map(entry => {
          const selected = selectedPaths.has(entry.path)
          return (
            <div
              key={entry.path}
              draggable
              className={`flex items-center gap-2 px-3 py-1 cursor-pointer text-[12px] transition-colors
                ${selected ? 'bg-primary/10 text-text-1' : 'hover:bg-bg-hover text-text-1'}`}
              onClick={(e) => { e.stopPropagation(); handleClick(e, entry) }}
              onDoubleClick={() => handleDoubleClick(entry)}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation()
                if (!selectedPaths.has(entry.path)) selectPath(entry.path)
                onContextMenu(e, entry)
              }}
              onDragStart={(e) => handleEntryDragStart(e, entry)}
            >
              <AppIcon icon={getFileTypeIcon(entry.name, entry.type).icon} size={14} className={`shrink-0 ${getFileTypeIcon(entry.name, entry.type).color}`} />
              {renamingPath === entry.path && onRename ? (
                <SftpInlineRename
                  name={entry.name}
                  path={entry.path}
                  onRename={onRename}
                />
              ) : (
                <span className="flex-1 truncate">{entry.name}</span>
              )}
              <span className="w-[60px] text-right text-[10px] text-text-3 shrink-0">
                {entry.type === 'dir' ? '-' : formatSize(entry.size)}
              </span>
              <span className="w-[110px] text-right text-[10px] text-text-3 shrink-0">
                {formatDate(entry.modifiedAt)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
