import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { ProtocolIcon } from '../icons/ProtocolIcons'
import { useUIStore } from '../../stores/useUIStore'
import { useAssetStore } from '../../stores/useAssetStore'
import { useTabStore } from '../../stores/useTabStore'
import { getColorTagTextClass } from '../../lib/color-tag'
import type { AssetRow } from '../../types'

/** 延迟值颜色：绿色 ≤80ms，黄色 ≤200ms，红色 >200ms / 超时 */
function latencyColor(val: string): string {
  if (val === '超时') return 'text-[#F53F3F]'
  const ms = parseInt(val)
  if (isNaN(ms)) return 'text-text-2'
  if (ms <= 80) return 'text-[#00B42A]'
  if (ms <= 200) return 'text-[#FF7D00]'
  return 'text-[#F53F3F]'
}

type SortKey = 'name' | 'latency' | 'host' | 'user' | 'created' | 'expire' | 'remark'
type SortDir = 'asc' | 'desc' | null

const columns: { key: SortKey; label: string; width: string }[] = [
  { key: 'name', label: '名称', width: 'w-[20%]' },
  { key: 'latency', label: '延迟', width: 'w-[10%]' },
  { key: 'host', label: 'Host', width: 'w-[15%]' },
  { key: 'user', label: 'User', width: 'w-[15%]' },
  { key: 'created', label: '创建时间', width: 'w-[15%]' },
  { key: 'expire', label: '到期时间', width: 'w-[15%]' },
  { key: 'remark', label: '备注', width: 'w-[10%]' },
]

function maskText(text: string, enabled: boolean): string {
  if (!enabled || !text || text === '-') return text
  if (text.length <= 2) return text[0] + '*'
  return text[0] + '*'.repeat(text.length - 2) + text[text.length - 1]
}

function sortData(data: AssetRow[], key: SortKey, dir: SortDir): AssetRow[] {
  if (!dir) return data
  return [...data].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  })
}

export default function AssetTable() {
  const showContextMenu = useUIStore((s) => s.showContextMenu)
  const currentFolder = useAssetStore((s) => s.currentFolder)
  const setCurrentFolder = useAssetStore((s) => s.setCurrentFolder)
  const isAnonymized = useAssetStore((s) => s.isAnonymized)
  const showPing = useAssetStore((s) => s.showPing)
  const pings = useAssetStore((s) => s.pings)
  const openAssetTab = useTabStore((s) => s.openAssetTab)
  const tableData = useAssetStore((s) => s.tableData)
  const moveConnectionToFolder = useAssetStore((s) => s.moveConnectionToFolder)
  const selectedRowIds = useAssetStore((s) => s.selectedRowIds)
  const setSelectedRowIds = useAssetStore((s) => s.setSelectedRowIds)
  const toggleRowSelection = useAssetStore((s) => s.toggleRowSelection)
  const clearRowSelection = useAssetStore((s) => s.clearRowSelection)

  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const lastClickedIndex = useRef<number>(-1)
  const tableRef = useRef<HTMLDivElement>(null)

  // 橡皮筋框选状态
  const [lasso, setLasso] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null)
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())
  const justFinishedLasso = useRef(false)
  const lassoActive = lasso !== null

  // 当前文件夹信息（用于 .. 行的创建时间）
  const currentFolderRow = currentFolder
    ? tableData.find(r => r.id === currentFolder && r.type === 'folder')
    : null

  // 根据当前文件夹过滤数据：根目录只显示文件夹 + 无归属的资产
  const filteredData = currentFolder
    ? tableData.filter(row => row.type === 'asset' && row.folderId === currentFolder)
    : tableData.filter(row => row.type === 'folder' || !row.folderId)

  // 排序
  const visibleData = useMemo(
    () => sortKey && sortDir ? sortData(filteredData, sortKey, sortDir) : filteredData,
    [filteredData, sortKey, sortDir],
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc')
      if (sortDir === 'desc') setSortKey(null)
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // 行点击处理：普通/Ctrl/Shift
  const handleRowClick = useCallback((e: React.MouseEvent, row: AssetRow, index: number) => {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey) {
      toggleRowSelection(row.id)
    } else if (e.shiftKey && lastClickedIndex.current >= 0) {
      const start = Math.min(lastClickedIndex.current, index)
      const end = Math.max(lastClickedIndex.current, index)
      const ids = new Set(selectedRowIds)
      for (let i = start; i <= end; i++) {
        if (visibleData[i]) ids.add(visibleData[i].id)
      }
      setSelectedRowIds(ids)
    } else {
      setSelectedRowIds(new Set([row.id]))
    }
    lastClickedIndex.current = index
  }, [selectedRowIds, setSelectedRowIds, toggleRowSelection, visibleData])

  // 橡皮筋框选
  const handleLassoStart = useCallback((e: React.MouseEvent) => {
    // 仅在空白区域（非行）开始框选
    if ((e.target as HTMLElement).closest('tr')) return
    if (e.button !== 0) return
    const rect = tableRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top + (tableRef.current?.scrollTop ?? 0)
    setLasso({ startX: x, startY: y, x, y })
    clearRowSelection()
  }, [clearRowSelection])

  useEffect(() => {
    if (!lasso) return
    const table = tableRef.current
    if (!table) return

    const handleMove = (e: MouseEvent) => {
      const rect = table.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top + table.scrollTop
      setLasso(prev => prev ? { ...prev, x, y } : null)

      // 计算框选矩形与行的交集
      const minX = Math.min(lasso.startX, x)
      const maxX = Math.max(lasso.startX, x)
      const minY = Math.min(lasso.startY, y)
      const maxY = Math.max(lasso.startY, y)
      const ids = new Set<string>()
      rowRefs.current.forEach((el, id) => {
        const rowRect = el.getBoundingClientRect()
        const rowTop = rowRect.top - rect.top + table.scrollTop
        const rowBottom = rowTop + rowRect.height
        const rowLeft = rowRect.left - rect.left
        const rowRight = rowLeft + rowRect.width
        if (maxX >= rowLeft && minX <= rowRight && maxY >= rowTop && minY <= rowBottom) {
          ids.add(id)
        }
      })
      setSelectedRowIds(ids)
    }

    const handleUp = () => {
      // 标记刚结束框选，防止后续 click 事件清空选择
      justFinishedLasso.current = true
      requestAnimationFrame(() => { justFinishedLasso.current = false })
      setLasso(null)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [lasso, lassoActive, setSelectedRowIds])

  return (
    <div
      id="asset-table"
      ref={tableRef}
      className="flex-1 overflow-auto custom-scrollbar relative"
      onContextMenu={(e) => {
        e.preventDefault()
        clearRowSelection()
        showContextMenu(e.clientX, e.clientY, 'table-context', { targetContext: 'blank', currentFolderId: currentFolder })
      }}
      onClick={() => { if (!justFinishedLasso.current) clearRowSelection() }}
      onMouseDown={handleLassoStart}
    >
      <table className="w-full text-left border-collapse whitespace-nowrap select-none">
        <thead className="sticky top-0 bg-bg-subtle z-10">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 py-3 text-[12px] font-medium text-text-2 border-b border-border ${col.width} cursor-pointer hover:text-text-1 transition-colors`}
                onClick={() => handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && sortDir === 'asc' ? (
                    <AppIcon icon={icons.chevronUp} size={14} className="text-primary" />
                  ) : sortKey === col.key && sortDir === 'desc' ? (
                    <AppIcon icon={icons.chevronDown} size={14} className="text-primary" />
                  ) : (
                    <AppIcon icon={icons.chevronDown} size={14} className="opacity-30" />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* .. 返回上一级行 */}
          {currentFolder && (
            <tr
              className="bg-bg-card cursor-pointer transition-colors"
              onDoubleClick={() => setCurrentFolder(null)}
              onDragOver={(e) => {
                e.preventDefault()
                e.currentTarget.classList.add('ring-2', 'ring-primary/50', 'ring-inset')
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-primary/50', 'ring-inset')
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('ring-2', 'ring-primary/50', 'ring-inset')
                const connectionId = e.dataTransfer.getData('text/connection-id')
                if (connectionId) moveConnectionToFolder(connectionId, null)
              }}
            >
              <td className="px-5 py-3 text-[13px] text-text-1 flex items-center gap-1.5">
                <AppIcon icon={icons.folder} size={14} className="text-icon-folder" />
                ..
              </td>
              <td className="px-4 py-3 text-[13px] text-text-2">-</td>
              <td className="px-4 py-3 text-[13px] text-text-2">-</td>
              <td className="px-4 py-3 text-[13px] text-text-2">-</td>
              <td className="px-4 py-3 text-[13px] text-text-2 font-mono">{currentFolderRow?.created ?? '-'}</td>
              <td className="px-4 py-3 text-[13px] text-text-2">-</td>
              <td className="px-4 py-3 text-[13px] text-text-2">-</td>
            </tr>
          )}
          {visibleData.map((row, idx) => (
            <tr
              key={row.id}
              ref={(el) => { if (el) rowRefs.current.set(row.id, el); else rowRefs.current.delete(row.id) }}
              className={`${selectedRowIds.has(row.id) ? 'bg-primary/10' : (idx + (currentFolder ? 1 : 0)) % 2 === 0 ? 'bg-bg-card' : 'bg-bg-subtle'} cursor-pointer group transition-colors hover:bg-primary/5`}
              draggable={row.type === 'asset'}
              onDragStart={(e) => {
                if (row.type === 'asset') {
                  e.dataTransfer.setData('text/connection-id', row.id)
                  e.dataTransfer.effectAllowed = 'move'
                }
              }}
              onDragOver={(e) => {
                if (row.type === 'folder') {
                  e.preventDefault()
                  e.currentTarget.classList.add('ring-2', 'ring-primary/50', 'ring-inset')
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('ring-2', 'ring-primary/50', 'ring-inset')
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.classList.remove('ring-2', 'ring-primary/50', 'ring-inset')
                if (row.type === 'folder') {
                  const connectionId = e.dataTransfer.getData('text/connection-id')
                  if (connectionId) moveConnectionToFolder(connectionId, row.id)
                }
              }}
              onClick={(e) => handleRowClick(e, row, idx)}
              onDoubleClick={() => {
                if (row.type === 'folder') {
                  setCurrentFolder(row.id)
                } else {
                  openAssetTab(row)
                }
              }}
              onContextMenu={(e) => {
                e.stopPropagation()
                e.preventDefault()
                showContextMenu(e.clientX, e.clientY, 'table-context', {
                  targetContext: row.type === 'folder' ? 'folder' : 'asset',
                  rowData: row,
                  currentFolderId: currentFolder,
                })
              }}
            >
              <td className="px-5 py-3 text-[13px] text-text-1 flex items-center gap-1.5">
                {row.type === 'folder' ? (
                  <AppIcon icon={icons.folderFill} size={15} className="text-icon-folder" />
                ) : (
                  <ProtocolIcon protocol={row.protocol} size={15} />
                )}
                <span className={getColorTagTextClass(row.colorTag)}>{maskText(row.name, isAnonymized)}</span>
              </td>
              <td className="px-4 py-3 text-[13px] text-text-2">
                {row.type === 'folder' ? '-' : (showPing ? (() => {
                  const val = pings[row.id] || row.latency
                  return <span className={latencyColor(val)}>{val}</span>
                })() : '-')}
              </td>
              <td className="px-4 py-3 text-[13px] text-text-2">{maskText(row.host, isAnonymized)}</td>
              <td className="px-4 py-3 text-[13px] text-text-2">{maskText(row.user, isAnonymized)}</td>
              <td className="px-4 py-3 text-[13px] text-text-2 font-mono">{row.created}</td>
              <td className="px-4 py-3 text-[13px] text-text-2">{row.expire}</td>
              <td className="px-4 py-3 text-[13px] text-text-2">{row.remark}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* 橡皮筋框选 overlay */}
      {lasso && (() => {
        const x = Math.min(lasso.startX, lasso.x)
        const y = Math.min(lasso.startY, lasso.y)
        const w = Math.abs(lasso.x - lasso.startX)
        const h = Math.abs(lasso.y - lasso.startY)
        return (
          <div
            className="absolute border border-primary/50 bg-primary/10 pointer-events-none z-20 rounded-sm"
            style={{ left: x, top: y, width: w, height: h }}
          />
        )
      })()}
    </div>
  )
}
