import { useState, useMemo } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { cn } from '../../lib/utils'
import type { ITheme } from '@xterm/xterm'
import type { ThemeSource } from '../../types/theme'
import { useThemeStore } from '../../stores/useThemeStore'

interface ThemeCardItem {
  id: string
  name: string
  source: ThemeSource
  theme: ITheme
}

/** 主题卡片色块预览 */
function ThemeCard({
  preset,
  selected,
  onClick,
}: {
  preset: ThemeCardItem
  selected: boolean
  onClick: () => void
}) {
  const t = preset.theme
  const dots = [t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan]

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex flex-col rounded-lg cursor-pointer border-[1.5px] transition-all overflow-hidden hover:shadow-sm',
        selected ? 'border-primary shadow-sm' : 'border-transparent hover:border-border',
      )}
    >
      {/* 背景色块 */}
      <div
        className="h-[48px] flex items-end justify-center gap-[4px] pb-2"
        style={{ backgroundColor: t.background }}
      >
        {dots.map((c, i) => (
          <div key={i} className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: c }} />
        ))}
      </div>
      {/* 名称 */}
      <div className="px-1.5 py-1.5 text-center">
        <span className={cn(
          'text-[11px] leading-tight block truncate',
          selected ? 'text-primary font-medium' : 'text-text-2',
        )}>
          {preset.name}
        </span>
        <span className="mt-0.5 block text-[9px] leading-tight text-text-3">
          {preset.source === 'builtin' ? '内置' : '自定义'}
        </span>
      </div>
    </div>
  )
}

export default function TermThemeGrid({
  mode,
  selectedId,
  onSelect,
}: {
  mode: 'light' | 'dark'
  selectedId: string
  onSelect: (id: string) => void
}) {
  const getThemesByMode = useThemeStore((s) => s.getThemesByMode)
  const [search, setSearch] = useState('')
  const themes = useMemo<ThemeCardItem[]>(
    () => getThemesByMode(mode).map((t) => ({
      id: t.id,
      name: t.name,
      source: t.source,
      theme: t.terminal,
    })),
    [getThemesByMode, mode],
  )
  const filtered = useMemo(() => {
    if (!search.trim()) return themes
    const q = search.toLowerCase()
    return themes.filter(t => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q))
  }, [themes, search])

  return (
    <div>
      {/* 搜索栏 */}
      <div className="relative mb-3">
        <AppIcon icon={icons.search} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索主题..."
          className="w-full h-[32px] pl-8 pr-3 rounded-lg border border-border bg-bg-base text-[12px] text-text-1 outline-none placeholder-text-disabled focus:border-primary/50 transition-colors"
        />
      </div>

      {/* 网格 */}
      <div className="grid grid-cols-5 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
        {filtered.map(preset => (
          <ThemeCard
            key={preset.id}
            preset={preset}
            selected={preset.id === selectedId}
            onClick={() => onSelect(preset.id)}
          />
        ))}
        {/* 自定义主题占位 */}
        <div className="flex flex-col items-center justify-center rounded-lg border-[1.5px] border-dashed border-border cursor-not-allowed opacity-50 min-h-[72px]">
          <AppIcon icon={icons.plus} size={16} className="text-text-3 mb-1" />
          <span className="text-[10px] text-text-3">自定义</span>
        </div>
      </div>
    </div>
  )
}
