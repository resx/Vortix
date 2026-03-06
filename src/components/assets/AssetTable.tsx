import { useState, useMemo } from 'react'
import { Folder, Terminal, ChevronDown, ChevronUp } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { getColorTagTextClass } from '../../lib/color-tag'
import type { AssetRow } from '../../types'

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
  const showContextMenu = useAppStore((s) => s.showContextMenu)
  const currentFolder = useAppStore((s) => s.currentFolder)
  const setCurrentFolder = useAppStore((s) => s.setCurrentFolder)
  const isAnonymized = useAppStore((s) => s.isAnonymized)
  const showPing = useAppStore((s) => s.showPing)
  const pings = useAppStore((s) => s.pings)
  const openAssetTab = useAppStore((s) => s.openAssetTab)
  const tableData = useAppStore((s) => s.tableData)
  const moveConnectionToFolder = useAppStore((s) => s.moveConnectionToFolder)

  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc')
      if (sortDir === 'desc') setSortKey(null)
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

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

  return (
    <div
      id="asset-table"
      className="flex-1 overflow-auto custom-scrollbar"
      onContextMenu={(e) => {
        e.preventDefault()
        showContextMenu(e.clientX, e.clientY, 'table-context', { targetContext: 'blank' })
      }}
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
                    <ChevronUp className="w-3.5 h-3.5 text-primary" />
                  ) : sortKey === col.key && sortDir === 'desc' ? (
                    <ChevronDown className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 opacity-30" />
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
                <Folder className="w-3.5 h-3.5 text-icon-folder fill-icon-folder" />
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
              className={`${(idx + (currentFolder ? 1 : 0)) % 2 === 0 ? 'bg-bg-card' : 'bg-bg-subtle'} cursor-pointer group transition-colors`}
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
                })
              }}
            >
              <td className="px-5 py-3 text-[13px] text-text-1 flex items-center gap-1.5">
                {row.type === 'folder' ? (
                  <Folder className="w-3.5 h-3.5 text-icon-folder fill-icon-folder" />
                ) : (
                  <Terminal className="w-3.5 h-3.5 text-icon-terminal" />
                )}
                <span className={getColorTagTextClass(row.colorTag)}>{maskText(row.name, isAnonymized)}</span>
              </td>
              <td className="px-4 py-3 text-[13px] text-text-2">
                {row.type === 'folder' ? '-' : (showPing ? (pings[row.id] || row.latency) : '-')}
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
    </div>
  )
}
