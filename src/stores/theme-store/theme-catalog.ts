import type { ITheme } from '@xterm/xterm'
import type {
  ThemeBehavior,
  ThemeHighlights,
  ThemeMeta,
  VortixTheme,
} from '../../types/theme'
import { DARK_THEMES } from '../../components/terminal/themes/dark-themes'
import { LIGHT_THEMES } from '../../components/terminal/themes/light-themes'
import { DEFAULT_HIGHLIGHTS } from '../../lib/theme-bridge'
import type { CustomThemePublic } from '../../api/types'

function defaultMeta(theme: Pick<VortixTheme, 'name' | 'source' | 'mode'>): ThemeMeta {
  const lowerName = theme.name.toLowerCase()
  const tags: string[] = [theme.mode]
  if (lowerName.includes('retro') || lowerName.includes('amber')) tags.push('retro')
  if (lowerName.includes('solar') || lowerName.includes('light')) tags.push('bright')
  if (lowerName.includes('catppuccin') || lowerName.includes('tokyo') || lowerName.includes('nord')) tags.push('popular')
  return {
    tags,
    originality: theme.source === 'builtin' ? 'compatible' : 'original',
  }
}

function presetToVortix(
  preset: { id: string; name: string; mode: 'light' | 'dark'; theme: ITheme },
): VortixTheme {
  return {
    id: preset.id,
    name: preset.name,
    mode: preset.mode,
    version: 1,
    source: 'builtin',
    terminal: preset.theme,
    highlights: { ...DEFAULT_HIGHLIGHTS },
    meta: defaultMeta({ name: preset.name, source: 'builtin', mode: preset.mode }),
  }
}

export function customToVortix(row: CustomThemePublic): VortixTheme {
  const base: VortixTheme = {
    id: row.id,
    name: row.name,
    mode: row.mode,
    version: 1,
    source: 'custom',
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    terminal: row.terminal as ITheme,
    highlights: row.highlights as unknown as ThemeHighlights,
    ui: row.ui as VortixTheme['ui'],
    meta: row.meta as ThemeMeta | undefined,
    behavior: row.behavior as ThemeBehavior | undefined,
    baseThemeId: row.base_theme_id ?? undefined,
  }
  return {
    ...base,
    meta: {
      ...defaultMeta({ name: row.name, source: 'custom', mode: row.mode }),
      ...(row.meta as ThemeMeta | undefined),
    },
  }
}

export const BUILTIN_THEMES: VortixTheme[] = [
  ...DARK_THEMES.map(presetToVortix),
  ...LIGHT_THEMES.map(presetToVortix),
]

export const BUILTIN_THEME_MAP = new Map<string, VortixTheme>(
  BUILTIN_THEMES.map((theme) => [theme.id, theme]),
)
