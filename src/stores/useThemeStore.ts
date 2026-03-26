import { create } from 'zustand'
import type { ITheme } from '@xterm/xterm'
import type {
  ThemeAnalysisIssue,
  ThemeAnalysisResult,
  ThemeBehavior,
  ThemeHighlights,
  ThemeMeta,
  ThemePreviewScenario,
  VortixTheme,
} from '../types/theme'
import { DARK_THEMES } from '../components/terminal/themes/dark-themes'
import { LIGHT_THEMES } from '../components/terminal/themes/light-themes'
import { DEFAULT_HIGHLIGHTS } from '../lib/theme-bridge'
import * as api from '../api/client'
import type { CustomThemePublic } from '../api/types'

const FAVORITES_KEY = 'vortix-theme-favorites'
const RECENTS_KEY = 'vortix-theme-recents'
const MAX_RECENT_THEMES = 8

function readStoredList(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function writeStoredList(key: string, values: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(values))
  } catch {
    // ignore storage failures
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function toHex(channel: number): string {
  return clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')
}

function parseHexColor(hex?: string): [number, number, number] | null {
  if (!hex) return null
  const cleaned = hex.trim().replace('#', '')
  const base = cleaned.length >= 6 ? cleaned.slice(0, 6) : ''
  if (!/^[0-9a-fA-F]{6}$/.test(base)) return null
  return [
    Number.parseInt(base.slice(0, 2), 16),
    Number.parseInt(base.slice(2, 4), 16),
    Number.parseInt(base.slice(4, 6), 16),
  ]
}

function luminance(hex?: string): number | null {
  const rgb = parseHexColor(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(fg?: string, bg?: string): number | null {
  const fgLum = luminance(fg)
  const bgLum = luminance(bg)
  if (fgLum == null || bgLum == null) return null
  const lighter = Math.max(fgLum, bgLum)
  const darker = Math.min(fgLum, bgLum)
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2))
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHexColor(hex)
  if (!rgb) return hex
  const alphaHex = toHex(clamp(alpha, 0, 1) * 255)
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}${alphaHex}`
}

function mixHex(a: string, b: string, weight: number): string {
  const rgbA = parseHexColor(a)
  const rgbB = parseHexColor(b)
  if (!rgbA) return b
  if (!rgbB) return a
  const w = clamp(weight, 0, 1)
  return `#${toHex(rgbA[0] * (1 - w) + rgbB[0] * w)}${toHex(rgbA[1] * (1 - w) + rgbB[1] * w)}${toHex(rgbA[2] * (1 - w) + rgbB[2] * w)}`
}

function isDarkBackground(hex?: string): boolean {
  const value = luminance(hex)
  return value == null ? true : value < 0.5
}

function bestContrastColor(bg?: string): string {
  return isDarkBackground(bg) ? '#F8FAFC' : '#0F172A'
}

function colorDistance(a?: string, b?: string): number | null {
  const rgbA = parseHexColor(a)
  const rgbB = parseHexColor(b)
  if (!rgbA || !rgbB) return null
  const [r1, g1, b1] = rgbA
  const [r2, g2, b2] = rgbB
  return Math.sqrt(
    (r1 - r2) ** 2 +
    (g1 - g2) ** 2 +
    (b1 - b2) ** 2,
  )
}

function average(values: Array<number | null>): number {
  const valid = values.filter((value): value is number => typeof value === 'number')
  if (valid.length === 0) return 0
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

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

function customToVortix(row: CustomThemePublic): VortixTheme {
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

const BUILTIN_THEMES: VortixTheme[] = [
  ...DARK_THEMES.map(presetToVortix),
  ...LIGHT_THEMES.map(presetToVortix),
]

const BUILTIN_MAP = new Map<string, VortixTheme>(
  BUILTIN_THEMES.map((theme) => [theme.id, theme]),
)

function getThemeChangedFields(theme: VortixTheme, baseline?: VortixTheme): string[] {
  if (!baseline) return []
  const changed = new Set<string>()
  for (const [key, value] of Object.entries(theme.terminal)) {
    if ((baseline.terminal as Record<string, string | undefined>)[key] !== value) {
      changed.add(`terminal.${key}`)
    }
  }
  for (const [key, value] of Object.entries(theme.highlights)) {
    if ((baseline.highlights as unknown as Record<string, string>)[key] !== value) {
      changed.add(`highlights.${key}`)
    }
  }
  if (JSON.stringify(theme.ui ?? {}) !== JSON.stringify(baseline.ui ?? {})) {
    changed.add('ui')
  }
  return [...changed]
}

function analyzeVortixTheme(theme: VortixTheme, baseline?: VortixTheme): ThemeAnalysisResult {
  const issues: ThemeAnalysisIssue[] = []
  const { terminal, ui } = theme
  const bg = terminal.background
  const fgContrast = contrastRatio(terminal.foreground, bg)
  const cursorContrast = contrastRatio(terminal.cursor ?? terminal.foreground, bg)
  const selectionContrast = contrastRatio(terminal.selectionBackground, bg)
  const primaryDrift = colorDistance(ui?.primary, terminal.blue)
  const paletteDistances = [
    colorDistance(terminal.red, terminal.green),
    colorDistance(terminal.blue, terminal.cyan),
    colorDistance(terminal.yellow, terminal.white),
    colorDistance(terminal.magenta, terminal.blue),
  ]
  const avgPaletteDistance = average(paletteDistances)

  if ((fgContrast ?? 0) < 4.5) {
    issues.push({
      level: 'error',
      code: 'low-contrast-foreground',
      field: 'terminal.foreground',
      message: 'Foreground and background contrast is below 4.5.',
    })
  }

  if ((cursorContrast ?? 0) < 3) {
    issues.push({
      level: 'warning',
      code: 'low-contrast-cursor',
      field: 'terminal.cursor',
      message: 'Cursor color is close to the background.',
    })
  }

  if (!terminal.selectionBackground) {
    issues.push({
      level: 'warning',
      code: 'missing-selection',
      field: 'terminal.selectionBackground',
      message: 'Selection background is missing.',
    })
  } else if ((selectionContrast ?? 0) < 1.4) {
    issues.push({
      level: 'warning',
      code: 'low-contrast-selection',
      field: 'terminal.selectionBackground',
      message: 'Selection highlight may be difficult to spot.',
    })
  }

  if (avgPaletteDistance < 70) {
    issues.push({
      level: 'warning',
      code: 'ansi-too-similar',
      field: 'terminal',
      message: 'Several ANSI colors are too similar.',
    })
  }

  if (!terminal.brightBlack || !terminal.brightBlue || !terminal.brightGreen || !terminal.brightRed) {
    issues.push({
      level: 'info',
      code: 'missing-bright-colors',
      field: 'terminal',
      message: 'Some bright ANSI colors are missing.',
    })
  }

  if (primaryDrift != null && primaryDrift > 140) {
    issues.push({
      level: 'info',
      code: 'ui-terminal-drift',
      field: 'ui.primary',
      message: 'UI primary color is drifting away from terminal blue.',
    })
  }

  const contrastScore = clamp(((fgContrast ?? 0) / 7) * 100, 0, 100)
  const distinctivenessScore = clamp((avgPaletteDistance / 160) * 100, 0, 100)
  const consistencyScore = clamp(100 - ((primaryDrift ?? 0) / 2.2), 0, 100)
  const penalty = issues.reduce((sum, issue) => {
    if (issue.level === 'error') return sum + 18
    if (issue.level === 'warning') return sum + 10
    return sum + 4
  }, 0)
  const score = clamp(
    Math.round((contrastScore * 0.45) + (distinctivenessScore * 0.3) + (consistencyScore * 0.25) - penalty),
    0,
    100,
  )

  return {
    score,
    contrastScore: Math.round(contrastScore),
    distinctivenessScore: Math.round(distinctivenessScore),
    consistencyScore: Math.round(consistencyScore),
    issues,
    changedFields: getThemeChangedFields(theme, baseline),
  }
}

function buildContrastSafeTheme(theme: VortixTheme): VortixTheme {
  const background = theme.terminal.background ?? '#1E1E1E'
  const safeForeground = bestContrastColor(background)
  const foregroundContrast = contrastRatio(theme.terminal.foreground, background)
  const cursorContrast = contrastRatio(theme.terminal.cursor ?? theme.terminal.foreground, background)
  const selectionContrast = theme.terminal.selectionBackground
    ? contrastRatio(theme.terminal.selectionBackground, background)
    : null
  const nextTerminal: ITheme = {
    ...theme.terminal,
    foreground: foregroundContrast != null && foregroundContrast >= 4.5
      ? theme.terminal.foreground
      : safeForeground,
    cursor: cursorContrast != null && cursorContrast >= 3
      ? theme.terminal.cursor
      : mixHex(safeForeground, background, 0.15),
    selectionBackground: theme.terminal.selectionBackground && selectionContrast != null
      && selectionContrast >= 1.4
      ? theme.terminal.selectionBackground
      : withAlpha(safeForeground, 0.28),
    brightBlack: theme.terminal.brightBlack ?? mixHex(background, safeForeground, 0.45),
    brightBlue: theme.terminal.brightBlue ?? theme.terminal.blue ?? '#60A5FA',
    brightGreen: theme.terminal.brightGreen ?? theme.terminal.green ?? '#4ADE80',
    brightRed: theme.terminal.brightRed ?? theme.terminal.red ?? '#F87171',
  }

  return {
    ...theme,
    terminal: nextTerminal,
    meta: {
      ...theme.meta,
      contrastScore: analyzeVortixTheme({ ...theme, terminal: nextTerminal }).contrastScore,
    },
  }
}

type ThemeDraftPatch =
  Partial<Omit<VortixTheme, 'terminal' | 'highlights' | 'ui' | 'meta' | 'behavior'>>
  & {
    terminal?: Partial<ITheme>
    highlights?: Partial<ThemeHighlights>
    ui?: VortixTheme['ui']
    meta?: ThemeMeta
    behavior?: ThemeBehavior
  }

interface ThemeStore {
  customThemes: VortixTheme[]
  loaded: boolean
  runtimeMode: 'light' | 'dark'
  runtimeVersion: number
  previewThemeId?: string
  compareThemeId?: string
  activeScenario: ThemePreviewScenario
  draftTheme?: VortixTheme
  dirty: boolean
  favorites: string[]
  recentThemeIds: string[]
  getAllThemes: () => VortixTheme[]
  getThemesByMode: (mode: 'light' | 'dark') => VortixTheme[]
  getThemeById: (id: string) => VortixTheme | undefined
  loadCustomThemes: () => Promise<void>
  createTheme: (data: Omit<VortixTheme, 'id' | 'source' | 'version' | 'createdAt' | 'updatedAt'>) => Promise<VortixTheme>
  updateTheme: (id: string, data: Partial<Pick<VortixTheme, 'name' | 'mode' | 'terminal' | 'highlights' | 'ui' | 'meta' | 'behavior' | 'baseThemeId'>>) => Promise<VortixTheme | undefined>
  deleteTheme: (id: string) => Promise<boolean>
  importThemes: (raw: string) => Promise<{ count: number; errors: string[] }>
  setRuntimeMode: (mode: 'light' | 'dark') => void
  setPreviewThemeId: (id?: string) => void
  setCompareThemeId: (id?: string) => void
  setActiveScenario: (scenario: ThemePreviewScenario) => void
  toggleFavorite: (id: string) => void
  markThemeUsed: (id: string) => void
  startDraftFromTheme: (id: string) => void
  updateDraftTheme: (patch: ThemeDraftPatch) => void
  discardDraftTheme: () => void
  repairDraftContrast: () => void
  analyzeTheme: (themeOrId: string | VortixTheme, baseline?: string | VortixTheme) => ThemeAnalysisResult
}

function getInitialRuntimeMode(): 'light' | 'dark' {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark'
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  customThemes: [],
  loaded: false,
  runtimeMode: getInitialRuntimeMode(),
  runtimeVersion: 0,
  previewThemeId: undefined,
  compareThemeId: undefined,
  activeScenario: 'shell',
  draftTheme: undefined,
  dirty: false,
  favorites: readStoredList(FAVORITES_KEY),
  recentThemeIds: readStoredList(RECENTS_KEY),

  getAllThemes: () => [...BUILTIN_THEMES, ...get().customThemes],

  getThemesByMode: (mode) => get().getAllThemes().filter((theme) => theme.mode === mode),

  getThemeById: (id) => {
    const builtin = BUILTIN_MAP.get(id)
    if (builtin) return builtin
    return get().customThemes.find((theme) => theme.id === id)
  },

  loadCustomThemes: async () => {
    try {
      const rows = await api.getCustomThemes()
      set({
        customThemes: rows.map(customToVortix),
        loaded: true,
      })
    } catch (error) {
      console.error('[Vortix] Failed to load custom themes', error)
      set({ loaded: true })
    }
  },

  createTheme: async (data) => {
    const row = await api.createCustomTheme({
      name: data.name,
      mode: data.mode,
      terminal: data.terminal as Record<string, string | undefined>,
      highlights: data.highlights as unknown as Record<string, string>,
      ui: data.ui as Record<string, string>,
      author: data.author,
    })
    const theme = customToVortix(row)
    set((state) => ({
      customThemes: [...state.customThemes, theme],
      previewThemeId: theme.id,
    }))
    get().markThemeUsed(theme.id)
    return theme
  },

  updateTheme: async (id, data) => {
    try {
      const row = await api.updateCustomTheme(id, {
        name: data.name,
        mode: data.mode,
        terminal: data.terminal as Record<string, string | undefined>,
        highlights: data.highlights as unknown as Record<string, string>,
        ui: data.ui as Record<string, string>,
      })
      const theme = customToVortix(row)
      set((state) => ({
        customThemes: state.customThemes.map((item) => item.id === id ? theme : item),
        draftTheme: state.draftTheme?.id === id ? theme : state.draftTheme,
        dirty: state.draftTheme?.id === id ? false : state.dirty,
      }))
      return theme
    } catch {
      return undefined
    }
  },

  deleteTheme: async (id) => {
    try {
      await api.deleteCustomTheme(id)
      set((state) => ({
        customThemes: state.customThemes.filter((theme) => theme.id !== id),
        previewThemeId: state.previewThemeId === id ? undefined : state.previewThemeId,
        compareThemeId: state.compareThemeId === id ? undefined : state.compareThemeId,
        draftTheme: state.draftTheme?.id === id ? undefined : state.draftTheme,
        dirty: state.draftTheme?.id === id ? false : state.dirty,
        favorites: state.favorites.filter((themeId) => themeId !== id),
        recentThemeIds: state.recentThemeIds.filter((themeId) => themeId !== id),
      }))
      writeStoredList(FAVORITES_KEY, get().favorites)
      writeStoredList(RECENTS_KEY, get().recentThemeIds)
      return true
    } catch {
      return false
    }
  },

  importThemes: async (raw) => {
    try {
      const result = await api.importThemes(raw)
      const themes = result.themes.map(customToVortix)
      set((state) => ({
        customThemes: [...state.customThemes, ...themes],
        previewThemeId: themes[0]?.id ?? state.previewThemeId,
      }))
      if (themes[0]) {
        get().markThemeUsed(themes[0].id)
      }
      return { count: themes.length, errors: result.errors }
    } catch (error) {
      return { count: 0, errors: [(error as Error).message] }
    }
  },

  setRuntimeMode: (mode) => set((state) => (
    state.runtimeMode === mode
      ? state
      : { runtimeMode: mode, runtimeVersion: state.runtimeVersion + 1 }
  )),

  setPreviewThemeId: (id) => set({ previewThemeId: id }),

  setCompareThemeId: (id) => set({ compareThemeId: id }),

  setActiveScenario: (scenario) => set({ activeScenario: scenario }),

  toggleFavorite: (id) => {
    const favorites = get().favorites.includes(id)
      ? get().favorites.filter((item) => item !== id)
      : [...get().favorites, id]
    set({ favorites })
    writeStoredList(FAVORITES_KEY, favorites)
  },

  markThemeUsed: (id) => {
    const recentThemeIds = [id, ...get().recentThemeIds.filter((item) => item !== id)].slice(0, MAX_RECENT_THEMES)
    set({ recentThemeIds })
    writeStoredList(RECENTS_KEY, recentThemeIds)
  },

  startDraftFromTheme: (id) => {
    const theme = get().getThemeById(id)
    if (!theme) return
    set({
      draftTheme: {
        ...theme,
        terminal: { ...theme.terminal },
        highlights: { ...theme.highlights },
        ui: theme.ui ? { ...theme.ui } : undefined,
        meta: theme.meta ? { ...theme.meta } : undefined,
        behavior: theme.behavior ? { ...theme.behavior } : undefined,
      },
      dirty: false,
      previewThemeId: id,
    })
  },

  updateDraftTheme: (patch) => {
    const draftTheme = get().draftTheme
    if (!draftTheme) return
    set({
      draftTheme: {
        ...draftTheme,
        ...patch,
        terminal: patch.terminal ? { ...draftTheme.terminal, ...patch.terminal } : draftTheme.terminal,
        highlights: patch.highlights ? { ...draftTheme.highlights, ...patch.highlights } : draftTheme.highlights,
        ui: patch.ui ? { ...draftTheme.ui, ...patch.ui } : draftTheme.ui,
        meta: patch.meta ? { ...draftTheme.meta, ...patch.meta } : draftTheme.meta,
        behavior: patch.behavior ? { ...draftTheme.behavior, ...patch.behavior } : draftTheme.behavior,
      },
      dirty: true,
    })
  },

  discardDraftTheme: () => set({ draftTheme: undefined, dirty: false }),

  repairDraftContrast: () => {
    const draftTheme = get().draftTheme
    if (!draftTheme) return
    set({
      draftTheme: buildContrastSafeTheme(draftTheme),
      dirty: true,
    })
  },

  analyzeTheme: (themeOrId, baseline) => {
    const resolveTheme = (value: string | VortixTheme | undefined) => {
      if (!value) return undefined
      return typeof value === 'string' ? get().getThemeById(value) : value
    }
    const theme = resolveTheme(themeOrId)
    const baselineTheme = resolveTheme(baseline)
    if (!theme) {
      return {
        score: 0,
        contrastScore: 0,
        distinctivenessScore: 0,
        consistencyScore: 0,
        issues: [],
        changedFields: [],
      }
    }
    return analyzeVortixTheme(theme, baselineTheme)
  },
}))
