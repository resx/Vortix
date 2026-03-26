import { AppIcon } from '../../icons/AppIcon'
import { cn } from '../../../lib/utils'
import type { ThemeCardItem } from './types'

export function ThemeGridCard({
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
        'group flex flex-col overflow-hidden rounded-xl border bg-bg-card/35 text-left transition-all hover:border-border hover:shadow-sm',
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
