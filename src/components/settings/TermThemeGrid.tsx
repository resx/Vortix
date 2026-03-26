import { useMemo, useState } from 'react'
import type { ITheme } from '@xterm/xterm'
import { AppIcon, icons } from '../icons/AppIcon'
import { cn } from '../../lib/utils'
import type { ThemeSource } from '../../types/theme'
import { useThemeStore } from '../../stores/useThemeStore'
import { useT } from '../../i18n'

type ThemeFilter = 'all' | 'favorites' | 'builtin' | 'custom'

interface ThemeCardItem {
  id: string
  name: string
  source: ThemeSource
  theme: ITheme
}

function ThemeCard({
  preset,
  selected,
  active,
  favorite,
  onPreview,
  onToggleFavorite,
  t,
}: {
  preset: ThemeCardItem
  selected: boolean
  active: boolean
  favorite: boolean
  onPreview: () => void
  onToggleFavorite: () => void
  t: (key: string) => string
}) {
  const dots = [
    preset.theme.red,
    preset.theme.green,
    preset.theme.yellow,
    preset.theme.blue,
    preset.theme.magenta,
    preset.theme.cyan,
  ]

  return (
    <button
      type="button"
      onClick={onPreview}
      className={cn(
        'group flex flex-col rounded-xl border text-left transition-all overflow-hidden bg-bg-card/35 hover:border-border hover:shadow-sm',
        selected ? 'border-primary shadow-sm shadow-primary/10' : 'border-border/60',
      )}
    >
      <div
        className="relative h-[56px] px-3 py-3"
        style={{ backgroundColor: preset.theme.background ?? '#1E1E1E' }}
      >
        <div className="absolute left-3 top-3 flex gap-1">
          {dots.map((color, index) => (
            <span
              key={index}
              className="h-[8px] w-[8px] rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: color ?? '#000000' }}
            />
          ))}
        </div>
        <button
          type="button"
          className={cn(
            'absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md transition-colors',
            favorite ? 'bg-white/16 text-yellow-300' : 'bg-black/20 text-white/70 hover:text-white',
          )}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite()
          }}
          aria-label={favorite ? t('themeWorkbench.grid.unfavoriteAria') : t('themeWorkbench.grid.favoriteAria')}
        >
          <AppIcon icon={favorite ? 'ph:star-fill' : 'ph:star'} size={13} />
        </button>
        {active && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/30 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-white/90">
            {t('themeWorkbench.state.active')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('truncate text-[12px] font-medium', selected ? 'text-primary' : 'text-text-1')}>
            {preset.name}
          </span>
          <span className="rounded-full bg-bg-base px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-text-3">
            {preset.source === 'builtin' ? t('themeWorkbench.source.builtin') : t('themeWorkbench.source.custom')}
          </span>
        </div>
        <span className="text-[10px] text-text-3">
          {selected ? t('themeWorkbench.grid.previewing') : t('themeWorkbench.grid.clickToPreview')}
        </span>
      </div>
    </button>
  )
}

export default function TermThemeGrid({
  mode,
  selectedId,
  previewId,
  onPreview,
}: {
  mode: 'light' | 'dark'
  selectedId: string
  previewId: string
  onPreview: (id: string) => void
}) {
  const t = useT()
  const getThemesByMode = useThemeStore((state) => state.getThemesByMode)
  const favorites = useThemeStore((state) => state.favorites)
  const toggleFavorite = useThemeStore((state) => state.toggleFavorite)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ThemeFilter>('all')

  const themes = useMemo<ThemeCardItem[]>(
    () => getThemesByMode(mode).map((theme) => ({
      id: theme.id,
      name: theme.name,
      source: theme.source,
      theme: theme.terminal,
    })),
    [getThemesByMode, mode],
  )

  const filteredThemes = useMemo(() => {
    const query = search.trim().toLowerCase()
    return themes.filter((theme) => {
      const matchesQuery = !query
        || theme.name.toLowerCase().includes(query)
        || theme.id.toLowerCase().includes(query)
      if (!matchesQuery) return false
      if (filter === 'favorites') return favorites.includes(theme.id)
      if (filter === 'builtin') return theme.source === 'builtin'
      if (filter === 'custom') return theme.source !== 'builtin'
      return true
    })
  }, [favorites, filter, search, themes])

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border/60 bg-bg-card/25 p-3">
      <div className="relative">
        <AppIcon icon={icons.search} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
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
            onClick={() => setFilter(value)}
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

      <div className="mt-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <div className="grid grid-cols-2 gap-2">
          {filteredThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              preset={theme}
              selected={theme.id === previewId}
              active={theme.id === selectedId}
              favorite={favorites.includes(theme.id)}
              onPreview={() => onPreview(theme.id)}
              onToggleFavorite={() => toggleFavorite(theme.id)}
              t={t}
            />
          ))}
        </div>

        {filteredThemes.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-border/80 px-4 py-6 text-center text-[12px] text-text-3">
            {t('themeWorkbench.grid.empty')}
          </div>
        )}
      </div>
    </div>
  )
}
