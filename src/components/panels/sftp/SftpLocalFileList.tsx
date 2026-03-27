import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { listLocalEntries, pickDir, type LocalFsEntry } from '../../../api/client'
import SftpPaneHeader from './SftpPaneHeader'
import { getFileTypeIcon } from '../../../lib/file-icons'

const COLUMN_DEFS: Record<string, { label: string; minWidth: number }> = {
  name: { label: '名称', minWidth: 180 },
  mtime: { label: '修改时间', minWidth: 150 },
  size: { label: '大小', minWidth: 90 },
  type: { label: '类型', minWidth: 90 },
}

function formatSize(bytes: number): string {
  if (bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function isRootPath(path: string): boolean {
  if (!path) return false
  const normalized = path.replace(/[\\/]+$/, '')
  return normalized === '' || normalized === '/' || /^[A-Za-z]:$/.test(normalized)
}

function getParentPath(path: string): string {
  if (!path || isRootPath(path)) return path
  const normalized = path.replace(/[\\/]+$/, '')
  const index = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))
  if (index <= 0) return normalized.includes(':') ? `${normalized.slice(0, 2)}\\` : '/'
  return normalized.slice(0, index)
}

function formatLocalDisplayPath(path: string): string {
  if (!path) return ''
  if (path.startsWith('\\\\?\\UNC\\')) {
    return `\\\\${path.slice('\\\\?\\UNC\\'.length)}`
  }
  if (path.startsWith('\\\\?\\')) {
    return path.slice('\\\\?\\'.length)
  }
  return path
}

interface Props {
  title?: string
  active?: boolean
  embedded?: boolean
  onTitleClick?: () => void
}

type LocalSortField = 'name' | 'mtime' | 'size' | 'type'
type LocalSortOrder = 'asc' | 'desc'

export default function SftpLocalFileList({ title = '本地目录', active = false, embedded = false, onTitleClick }: Props) {
  const [currentPath, setCurrentPath] = useState<string>('')
  const [entries, setEntries] = useState<LocalFsEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<LocalSortField>('name')
  const [sortOrder, setSortOrder] = useState<LocalSortOrder>('asc')

  const columnKeys = useMemo(() => ['name', 'mtime', 'size', 'type'], [])
  const gridTemplateColumns = 'minmax(240px,3.2fr) minmax(150px,1.4fr) minmax(110px,1fr) minmax(110px,1fr)'

  const refresh = useCallback(async (path?: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await listLocalEntries(path)
      setCurrentPath(result.path || path || '')
      setEntries(result.entries || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh(currentPath || undefined)
  }, [currentPath, refresh])

  const pickLocalRoot = useCallback(async () => {
    const selected = await pickDir(currentPath || undefined)
    if (!selected) return
    setCurrentPath(selected)
  }, [currentPath])

  const goUp = useCallback(() => {
    if (isRootPath(currentPath)) return
    setCurrentPath(getParentPath(currentPath))
  }, [currentPath])

  const toggleSort = useCallback((field: LocalSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortOrder('asc')
      return field
    })
  }, [])

  const sortedEntries = useMemo(() => {
    const list = [...entries]
    list.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1
      if (a.type !== 'dir' && b.type === 'dir') return 1
      let cmp = 0
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'zh-CN')
          break
        case 'mtime':
          cmp = (new Date(a.modifiedAt || '').getTime() || 0) - (new Date(b.modifiedAt || '').getTime() || 0)
          break
        case 'size': {
          const as = a.type === 'file' ? a.size : -1
          const bs = b.type === 'file' ? b.size : -1
          cmp = as - bs
          break
        }
        case 'type':
          cmp = (a.type === 'dir' ? 'folder' : 'file').localeCompare(b.type === 'dir' ? 'folder' : 'file')
          break
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return list
  }, [entries, sortField, sortOrder])

  const SortIcon = ({ field }: { field: LocalSortField }) => (
    <div className={`inline-flex flex-col ml-1 items-center justify-center align-middle transition-opacity shrink-0 ${sortField === field ? 'opacity-100' : 'opacity-25'}`}>
      <AppIcon icon={icons.chevronUp} size={10} className={`-mb-1.5 ${sortField === field && sortOrder === 'asc' ? 'text-blue-500' : ''}`} />
      <AppIcon icon={icons.chevronDown} size={10} className={`${sortField === field && sortOrder === 'desc' ? 'text-blue-500' : ''}`} />
    </div>
  )

  return (
    <div className={`flex h-full min-h-0 flex-col ${embedded ? '' : 'rounded-2xl border border-gray-100 bg-white shadow-sm'}`}>
      <SftpPaneHeader
        title={title}
        path={formatLocalDisplayPath(currentPath)}
        active={active}
        onTitleClick={onTitleClick}
        pathActions={[
          {
            key: 'up',
            title: '返回上一级',
            icon: icons.chevronUp,
            disabled: isRootPath(currentPath),
            onClick: goUp,
          },
          {
            key: 'refresh',
            title: '刷新本地目录',
            icon: icons.refresh,
            onClick: () => { void refresh(currentPath || undefined) },
          },
          {
            key: 'pick',
            title: '选择目录',
            icon: icons.folderOpen,
            onClick: () => { void pickLocalRoot() },
          },
        ]}
        onPathSubmit={(next) => { setCurrentPath(next) }}
      />

      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="flex h-full items-center justify-center text-text-3">
            <AppIcon icon={icons.loader} size={18} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="px-4 py-3 text-[12px] text-status-error">{error}</div>
        ) : (
          <div>
            <div className="sticky top-0 z-10 grid border-b border-gray-100 bg-white text-[12px] text-text-3" style={{ gridTemplateColumns }}>
              {columnKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="flex items-center gap-1 truncate px-3 py-2 text-left hover:bg-gray-50"
                  onClick={() => toggleSort(key as LocalSortField)}
                >
                  <span className="truncate">{COLUMN_DEFS[key]?.label ?? key}</span>
                  <SortIcon field={key as LocalSortField} />
                </button>
              ))}
            </div>

            {!isRootPath(currentPath) && (
              <button
                type="button"
                className="grid min-h-[42px] w-full border-b border-gray-50 text-left text-[13px] hover:bg-blue-50/60"
                style={{ gridTemplateColumns }}
                onClick={() => setCurrentPath(getParentPath(currentPath))}
              >
                {columnKeys.map((key) => (
                  key === 'name'
                    ? (
                      <div key={key} className="flex items-center gap-3 px-3 py-2 text-text-2">
                        <AppIcon icon={icons.folder} size={20} className="text-yellow-500" />
                        <span>..</span>
                      </div>
                    )
                    : <div key={key} className="px-3 py-2 text-center text-text-3">-</div>
                ))}
              </button>
            )}

            {sortedEntries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className="grid min-h-[42px] w-full border-b border-gray-50 text-left text-[13px] transition-colors hover:bg-blue-50/60"
                style={{ gridTemplateColumns }}
                onDoubleClick={() => {
                  if (entry.type === 'dir') {
                    setCurrentPath(entry.path)
                  }
                }}
              >
                {columnKeys.map((key) => {
                  if (key === 'name') {
                    const iconInfo = getFileTypeIcon(entry.name, entry.type === 'dir' ? 'dir' : 'file')
                    return (
                      <div key={key} className="flex items-center gap-3 truncate px-3 py-2 text-text-1">
                        <AppIcon
                          icon={iconInfo.icon}
                          size={20}
                          className={entry.type === 'dir' ? 'text-yellow-500 fill-yellow-400' : `${iconInfo.color} fill-current opacity-90`}
                        />
                        <span className="truncate" title={entry.path}>{entry.name}</span>
                      </div>
                    )
                  }
                  if (key === 'type') return <div key={key} className="px-3 py-2 text-left text-text-2">{entry.type === 'dir' ? '文件夹' : '文件'}</div>
                  if (key === 'size') return <div key={key} className="px-3 py-2 text-right font-mono text-text-2">{entry.type === 'file' ? formatSize(entry.size) : '-'}</div>
                  if (key === 'mtime') return <div key={key} className="px-3 py-2 text-right font-mono text-text-2">{entry.modifiedAt || '-'}</div>
                  return <div key={key} className="px-3 py-2 text-right text-text-3">-</div>
                })}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
