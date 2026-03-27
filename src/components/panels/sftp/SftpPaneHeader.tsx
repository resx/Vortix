import { useMemo, useState } from 'react'
import { AppIcon } from '../../icons/AppIcon'

type PaneAction = {
  key: string
  title: string
  icon: string
  onClick: () => void
  disabled?: boolean
}

interface Props {
  title: string
  path: string
  active?: boolean
  pathActions?: PaneAction[]
  titleActions?: PaneAction[]
  onTitleClick?: () => void
  searchEnabled?: boolean
  searchExpanded?: boolean
  searchValue?: string
  onSearchToggle?: () => void
  onSearchChange?: (value: string) => void
  onSearchClear?: () => void
  onPathSubmit: (path: string) => void
}

function splitPathCapsules(path: string): string[] {
  if (!path) return ['-']
  const normalized = path.replace(/\\/g, '/')
  const driveMatch = normalized.match(/^[A-Za-z]:/)
  if (driveMatch) {
    const drive = driveMatch[0]
    const rest = normalized.slice(drive.length).replace(/^\/+/, '')
    if (!rest) return [drive]
    return [drive, ...rest.split('/').filter(Boolean)]
  }
  if (normalized.startsWith('/')) {
    const parts = normalized.split('/').filter(Boolean)
    return ['/', ...parts]
  }
  return normalized.split('/').filter(Boolean)
}

export default function SftpPaneHeader({
  title,
  path,
  active = false,
  pathActions = [],
  titleActions = [],
  onTitleClick,
  searchEnabled = false,
  searchExpanded = false,
  searchValue = '',
  onSearchToggle,
  onSearchChange,
  onSearchClear,
  onPathSubmit,
}: Props) {
  const [editingPath, setEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState('')
  const capsules = useMemo(() => splitPathCapsules(path), [path])

  const btnClass = useMemo(
    () => 'inline-flex h-7 w-7 items-center justify-center rounded-md text-text-2 transition-colors hover:bg-bg-hover disabled:opacity-35',
    [],
  )

  return (
    <div className={`border-b ${active ? 'border-primary/30 bg-primary/5' : 'border-gray-100'} px-3 py-2`}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex max-w-[55%] items-center rounded-full bg-bg-subtle px-3 py-1 text-[12px] font-semibold text-text-2 hover:bg-bg-hover"
          onClick={onTitleClick}
          title={title}
        >
          <span className="truncate">{title}</span>
        </button>
        <div className="flex items-center gap-1">
          {searchEnabled && (
            <div className="flex items-center">
              <div className={`overflow-hidden transition-all duration-200 ${searchExpanded ? 'mr-1 w-[160px] opacity-100' : 'w-0 opacity-0'}`}>
                <input
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="h-7 w-full rounded-md border border-border bg-bg-subtle px-2 text-[11px] text-text-2 outline-none"
                  placeholder="筛选..."
                />
              </div>
              <button
                type="button"
                className={btnClass}
                title={searchExpanded ? '收起筛选' : '展开筛选'}
                onClick={searchExpanded ? onSearchClear : onSearchToggle}
              >
                <AppIcon icon={searchExpanded ? 'ri:close-line' : 'ri:search-line'} size={14} />
              </button>
            </div>
          )}
          {titleActions.map((action) => (
            <button
              key={action.key}
              type="button"
              className={btnClass}
              title={action.title}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              <AppIcon icon={action.icon} size={14} />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {pathActions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={btnClass}
            title={action.title}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            <AppIcon icon={action.icon} size={14} />
          </button>
        ))}
        {editingPath ? (
          <input
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg-subtle px-2 py-1 font-mono text-[11px] text-text-2 outline-none"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onBlur={() => {
              const next = pathInput.trim()
              if (next) onPathSubmit(next)
              setEditingPath(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const next = pathInput.trim()
                if (next) onPathSubmit(next)
                setEditingPath(false)
              } else if (e.key === 'Escape') {
                setEditingPath(false)
              }
            }}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 rounded-lg bg-bg-subtle px-2 py-1 text-left text-[11px] text-text-3 hover:bg-bg-hover"
            title={path}
            onClick={() => {
              setPathInput(path)
              setEditingPath(true)
            }}
          >
            <span className="flex items-center gap-1 overflow-hidden">
              {capsules.map((segment, index) => (
                <span key={`${segment}-${index}`} className="inline-flex min-w-0 items-center">
                  {index > 0 && <span className="mx-1 text-text-3">{'>'}</span>}
                  <span className="max-w-[180px] truncate rounded-full bg-white/70 px-2 py-0.5 font-mono text-[11px] text-text-2">
                    {segment}
                  </span>
                </span>
              ))}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
