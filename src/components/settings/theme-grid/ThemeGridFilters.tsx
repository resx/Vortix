import { AppIcon, icons } from '../../icons/AppIcon'
import { cn } from '../../../lib/utils'
import type { ThemeFilter } from './types'

export function ThemeGridFilters({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  t,
}: {
  search: string
  onSearchChange: (value: string) => void
  filter: ThemeFilter
  onFilterChange: (value: ThemeFilter) => void
  t: (key: string) => string
}) {
  return (
    <>
      <div className="relative">
        <AppIcon icon={icons.search} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('themeWorkbench.grid.searchPlaceholder')}
          className="h-[34px] w-full rounded-lg border border-border bg-bg-base pl-8 pr-3 text-[12px] text-text-1 outline-none transition-colors placeholder:text-text-3 focus:border-primary/50"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {([
          ['all', t('themeWorkbench.grid.filter.all')],
          ['favorites', t('themeWorkbench.grid.filter.favorites')],
          ['builtin', t('themeWorkbench.grid.filter.builtin')],
          ['custom', t('themeWorkbench.grid.filter.custom')],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onFilterChange(value)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] transition-colors',
              filter === value
                ? 'bg-primary text-white'
                : 'bg-bg-base text-text-2 hover:text-text-1',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  )
}
