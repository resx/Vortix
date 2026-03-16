/* ── SFTP 文件列表（岛屿风格版 - Grid 布局） ── */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSettingsStore } from '../../../stores/useSettingsStore'
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

function getFileExt(name: string, type: string): string {
  if (type === 'dir') return '文件夹'
  if (type === 'symlink') return '链接'
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '文件'
}

/** 列定义映射 */
const COLUMN_DEFS: Record<string, { field: SftpSortField | null; label: string; minWidth: number; align: string }> = {
  name: { field: 'name', label: '名称', minWidth: 180, align: 'text-left' },
  mtime: { field: 'modifiedAt', label: '修改时间', minWidth: 150, align: 'text-center' },
  type: { field: null, label: '类型', minWidth: 80, align: 'text-center' },
  size: { field: 'size', label: '大小', minWidth: 80, align: 'text-center' },
  perm: { field: null, label: '权限', minWidth: 80, align: 'text-center' },
  owner: { field: null, label: '用户/组', minWidth: 80, align: 'text-center' },
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
  const currentPath = useSftpStore(s => s.currentPath)
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

  const sftpParentDirClick = useSettingsStore(s => s.sftpParentDirClick)
  const sftpRemoteColumns = useSettingsStore(s => s.sftpRemoteColumns)

  const visibleColumns = sftpRemoteColumns.filter(c => c in COLUMN_DEFS && c !== 'name')
  const columnKeys = ['name', ...visibleColumns]
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const [key, def] of Object.entries(COLUMN_DEFS)) {
      initial[key] = def.minWidth
    }
    return initial
  })

  const minTableWidth = columnKeys.reduce((sum, col) => sum + (columnWidths[col] ?? COLUMN_DEFS[col].minWidth), 0)
  const gridTemplateColumns = columnKeys.map((col) => {
    const def = COLUMN_DEFS[col]
    const width = columnWidths[col] ?? def.minWidth
    return `minmax(${width}px, 1fr)`
  }).join(' ')

  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null)
  const startResize = useCallback((col: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const width = columnWidths[col] ?? COLUMN_DEFS[col].minWidth
    resizingRef.current = { col, startX: e.clientX, startWidth: width }
  }, [columnWidths])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const { col, startX, startWidth } = resizingRef.current
      const def = COLUMN_DEFS[col]
      if (!def) return
      const next = Math.max(def.minWidth, Math.round(startWidth + (e.clientX - startX)))
      setColumnWidths(prev => ({ ...prev, [col]: next }))
    }
    const handleUp = () => { resizingRef.current = null }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  const [dragOver, setDragOver] = useState(false)
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true)
  }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOver(false)
  }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (!onFileDrop) return
    const files: File[] = []
    for (let i = 0; i < e.dataTransfer.files.length; i++) files.push(e.dataTransfer.files[i])
    if (files.length > 0) onFileDrop(files)
  }, [onFileDrop])

  const handleEntryDragStart = useCallback((e: React.DragEvent, entry: SftpFileEntry) => {
    e.dataTransfer.setData('text/sftp-path', entry.path); e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const visible = entries.filter(e => e.name !== '.' && e.name !== '..' && (showHidden || !e.name.startsWith('.')))
  const filtered = searchQuery ? visible.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())) : visible
  const sorted = [...filtered].sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1
    if (a.type !== 'dir' && b.type === 'dir') return 1
    let cmp = 0
    switch (sortField) {
      case 'name': cmp = a.name.localeCompare(b.name, 'zh-CN'); break
      case 'size': {
        const aUnknown = a.type === 'dir' && a.size < 0
        const bUnknown = b.type === 'dir' && b.size < 0
        if (aUnknown || bUnknown) {
          if (aUnknown && bUnknown) return 0
          return aUnknown ? 1 : -1
        }
        cmp = a.size - b.size
        break
      }
      case 'modifiedAt': cmp = new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime(); break
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ field }: { field: SftpSortField }) => (
    <div className={`inline-flex flex-col ml-1 items-center justify-center align-middle transition-opacity shrink-0 ${sortField === field ? 'opacity-100' : 'opacity-25'}`}>
      <AppIcon icon={icons.chevronUp} size={10} className={`-mb-1.5 ${sortField === field && sortOrder === 'asc' ? 'text-blue-500' : ''}`} />
      <AppIcon icon={icons.chevronDown} size={10} className={`${sortField === field && sortOrder === 'desc' ? 'text-blue-500' : ''}`} />
    </div>
  )

  const lastClickRef = useRef<string | null>(null)
  const handleClick = useCallback((e: React.MouseEvent, entry: SftpFileEntry) => {
    if (e.ctrlKey || e.metaKey) toggleSelect(entry.path)
    else if (e.shiftKey && lastClickRef.current) {
      const lastIdx = sorted.findIndex(f => f.path === lastClickRef.current)
      const curIdx = sorted.findIndex(f => f.path === entry.path)
      if (lastIdx >= 0 && curIdx >= 0) {
        const start = Math.min(lastIdx, curIdx), end = Math.max(lastIdx, curIdx)
        selectRange(sorted.slice(start, end + 1).map(f => f.path))
      }
    } else selectPath(entry.path)
    lastClickRef.current = entry.path
  }, [sorted, toggleSelect, selectRange, selectPath])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey, key = e.key
    if (ctrl && key === 'a') { e.preventDefault(); selectAll(); return }
    if (key === 'Escape') { clearSelection(); return }
    const selectedArr = sorted.filter(f => selectedPaths.has(f.path))
    if (key === 'Enter' && selectedArr.length === 1) {
      e.preventDefault(); const entry = selectedArr[0]
      if (entry.type === 'dir') onNavigate(entry.path)
      else onDoubleClick(entry)
    }
  }, [sorted, selectedPaths, selectAll, clearSelection, onNavigate, onDoubleClick])

  if (connecting || (!connected && !loading)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
        <AppIcon icon={icons.loader} size={24} className="opacity-40 animate-spin" />
        <span className="text-[13px]">正在连接 SFTP...</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <AppIcon icon={icons.loader} size={20} className="opacity-50 animate-spin" />
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
      {dragOver && (
        <div className="absolute inset-0 z-20 bg-blue-50/50 border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center pointer-events-none backdrop-blur-[1px]">
          <span className="text-[13px] text-blue-600 font-medium">释放以上传</span>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-x-auto custom-scrollbar">
          <div style={{ minWidth: `${minTableWidth}px` }}>
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="grid text-[13px] text-gray-500 font-medium" style={{ gridTemplateColumns }}>
                {columnKeys.map((col) => {
                  const def = COLUMN_DEFS[col]
                  return (
                    <div
                      key={col}
                      className="py-2.5 px-4 font-normal cursor-pointer hover:bg-gray-50 transition-colors relative group select-none min-w-0"
                      onClick={() => def.field && toggleSort(def.field)}
                    >
                      <div className="flex items-center gap-1 overflow-hidden justify-start">
                        <span className="truncate">{def.label}</span>
                        {def.field ? <SortIcon field={def.field} /> : col === 'type' ? <AppIcon icon={icons.chevronDown} size={11} className="opacity-40 shrink-0" /> : null}
                      </div>
                      <div
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize z-20"
                        onMouseDown={(e) => startResize(col, e)}
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="absolute right-0 top-2 bottom-2 w-px bg-gray-200 group-hover:bg-blue-400" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="text-[13px]">
              {currentPath !== '/' && (
                <div
                  className="grid border-b border-gray-50 cursor-pointer hover:bg-blue-50/30 even:bg-gray-50/30 odd:bg-white"
                  style={{ gridTemplateColumns }}
                  onClick={() => sftpParentDirClick && onNavigate(currentPath.replace(/\/[^/]+\/?$/, '') || '/')}
                  onDoubleClick={() => onNavigate(currentPath.replace(/\/[^/]+\/?$/, '') || '/')}
                >
                  {columnKeys.map((col) => {
                    if (col === 'name') {
                      return (
                        <div key={col} className="py-2 px-4 flex items-center gap-3 text-left min-w-0">
                          <AppIcon icon={icons.folder} size={20} className="shrink-0 text-yellow-400 fill-yellow-400" />
                          <span className="truncate font-medium text-gray-700">..</span>
                        </div>
                      )
                    }
                    return (
                      <div key={col} className="py-2 px-4 text-center text-gray-300 opacity-50">-</div>
                    )
                  })}
                </div>
              )}
              {sorted.map((entry) => {
                const selected = selectedPaths.has(entry.path)
                const iconInfo = getFileTypeIcon(entry.name, entry.type)
                return (
                  <div
                    key={entry.path}
                    draggable
                    className={`grid border-b border-gray-50 transition-colors cursor-pointer ${selected ? 'bg-blue-50/80! text-blue-700' : 'hover:bg-blue-50/50 even:bg-gray-50/30 odd:bg-white'}`}
                    style={{ gridTemplateColumns }}
                    onClick={(e) => { e.stopPropagation(); handleClick(e, entry) }}
                    onDoubleClick={() => entry.type === 'dir' ? onNavigate(entry.path) : onDoubleClick(entry)}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!selectedPaths.has(entry.path)) selectPath(entry.path); onContextMenu(e, entry) }}
                    onDragStart={(e) => handleEntryDragStart(e, entry)}
                  >
                    {columnKeys.map(col => {
                      if (col === 'name') {
                        return (
                          <div key={col} className="py-2 px-4 flex items-center gap-3 text-left min-w-0">
                            <AppIcon icon={iconInfo.icon} size={20} className={`shrink-0 ${iconInfo.color} ${entry.type === 'dir' ? 'fill-yellow-400' : 'fill-current opacity-80'}`} />
                            {renamingPath === entry.path && onRename
                              ? <SftpInlineRename name={entry.name} path={entry.path} onRename={onRename} />
                              : <span className={`truncate ${entry.type === 'dir' ? 'font-medium text-gray-700' : 'text-gray-800'}`}>{entry.name}</span>}
                          </div>
                        )
                      }
                      let val = '-'
                      switch (col) {
                        case 'size':
                          val = entry.type === 'dir' && entry.size < 0 ? '-' : formatSize(entry.size)
                          break
                        case 'mtime': val = formatDate(entry.modifiedAt); break
                        case 'type': val = getFileExt(entry.name, entry.type); break
                        case 'perm': val = entry.permissions || '-'; break
                        case 'owner': val = entry.owner !== undefined && entry.group !== undefined ? `${entry.owner}:${entry.group}` : '-'; break
                      }
                      const isMono = col === 'mtime' || col === 'perm' || col === 'owner' || col === 'size'
                      return (
                        <div key={col} className={`py-2 px-4 text-center text-gray-600 truncate ${isMono ? 'font-mono text-[13px]' : ''}`}>
                          {val}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
