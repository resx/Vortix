import { useMemo, useState } from 'react'
import { useThemeStore } from '../../stores/useThemeStore'
import { useT } from '../../i18n'
import { ThemeGridCard } from './theme-grid/ThemeGridCard'
import { ThemeGridFilters } from './theme-grid/ThemeGridFilters'
import type { ThemeCardItem, ThemeFilter } from './theme-grid/types'

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
      <ThemeGridFilters
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        t={t}
      />

      <div className="custom-scrollbar mt-3 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2">
          {filteredThemes.map((theme) => (
            <ThemeGridCard
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
