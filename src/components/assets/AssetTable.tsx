import { Folder, Terminal, ChevronDown } from 'lucide-react'
import { TABLE_DATA } from '../../data/mock'
import { useAppStore } from '../../stores/useAppStore'

const columns = [
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

export default function AssetTable() {
  const showContextMenu = useAppStore((s) => s.showContextMenu)
  const currentFolder = useAppStore((s) => s.currentFolder)
  const setCurrentFolder = useAppStore((s) => s.setCurrentFolder)
  const isAnonymized = useAppStore((s) => s.isAnonymized)
  const showPing = useAppStore((s) => s.showPing)
  const pings = useAppStore((s) => s.pings)
  const openAssetTab = useAppStore((s) => s.openAssetTab)

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
              <th key={col.key} className={`px-4 py-3 text-[12px] font-medium text-text-2 border-b border-border ${col.width}`}>
                <div className="flex items-center gap-1">
                  {col.label}
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        {currentFolder === null && (
          <tbody>
            {TABLE_DATA.map((row, idx) => (
              <tr
                key={row.id}
                className={`${idx % 2 === 0 ? 'bg-bg-card' : 'bg-bg-subtle'} hover:bg-bg-hover cursor-pointer transition-colors group`}
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
                  {maskText(row.name, isAnonymized)}
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
        )}
      </table>
    </div>
  )
}
