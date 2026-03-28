import { AppIcon, icons } from '../../../icons/AppIcon'
import type { SftpSessionId } from '../../../../stores/useSftpStore'
import type { SftpSortField } from '../../../../types/sftp'
import { COLUMN_DEFS } from './utils'

interface HeaderRowProps {
  columnKeys: string[]
  gridTemplateColumns: string
  sortField: SftpSortField
  sortOrder: 'asc' | 'desc'
  toggleSort: (field: SftpSortField, sessionId: SftpSessionId) => void
  sessionId: SftpSessionId
}

function SortIcon({ field, sortField, sortOrder }: { field: SftpSortField; sortField: SftpSortField; sortOrder: 'asc' | 'desc' }) {
  return (
    <div className={`inline-flex flex-col ml-1 items-center justify-center align-middle transition-opacity shrink-0 ${sortField === field ? 'opacity-100' : 'opacity-25'}`}>
      <AppIcon icon={icons.chevronUp} size={10} className={`-mb-1.5 ${sortField === field && sortOrder === 'asc' ? 'text-blue-500' : ''}`} />
      <AppIcon icon={icons.chevronDown} size={10} className={`${sortField === field && sortOrder === 'desc' ? 'text-blue-500' : ''}`} />
    </div>
  )
}

export function HeaderRow({ columnKeys, gridTemplateColumns, sortField, sortOrder, toggleSort, sessionId }: HeaderRowProps) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="grid text-[13px] text-gray-500 font-medium" style={{ gridTemplateColumns }}>
        {columnKeys.map((col) => {
          const def = COLUMN_DEFS[col]
          return (
            <div
              key={col}
              className="py-2.5 px-4 font-normal cursor-pointer hover:bg-gray-50 transition-colors relative group select-none min-w-0"
              onClick={() => def.field && toggleSort(def.field, sessionId)}
            >
              <div className="flex items-center gap-1 overflow-hidden justify-start">
                <span className="truncate">{def.label}</span>
                {def.field ? <SortIcon field={def.field} sortField={sortField} sortOrder={sortOrder} /> : col === 'type' ? <AppIcon icon={icons.chevronDown} size={11} className="opacity-40 shrink-0" /> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
