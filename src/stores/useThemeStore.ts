import { create } from 'zustand'
import type { ITheme } from '@xterm/xterm'
import type {
  ThemeAnalysisResult,
  ThemeBehavior,
  ThemeHighlights,
  ThemeMeta,
  ThemePreviewScenario,
  VortixTheme,
} from '../types/theme'
import * as api from '../api/client'
import { analyzeVortixTheme, buildContrastSafeTheme } from './theme-store/theme-analysis'
import { BUILTIN_THEME_MAP, BUILTIN_THEMES, customToVortix } from './theme-store/theme-catalog'
import {
  MAX_RECENT_THEMES,
  readFavoriteThemeIds,
  readRecentThemeIds,
  writeFavoriteThemeIds,
  writeRecentThemeIds,
} from './theme-store/theme-storage'

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
  favorites: readFavoriteThemeIds(),
  recentThemeIds: readRecentThemeIds(),

  getAllThemes: () => [...BUILTIN_THEMES, ...get().customThemes],

  getThemesByMode: (mode) => get().getAllThemes().filter((theme) => theme.mode === mode),

  getThemeById: (id) => {
    const builtin = BUILTIN_THEME_MAP.get(id)
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
      writeFavoriteThemeIds(get().favorites)
      writeRecentThemeIds(get().recentThemeIds)
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
    writeFavoriteThemeIds(favorites)
  },

  markThemeUsed: (id) => {
    const recentThemeIds = [id, ...get().recentThemeIds.filter((item) => item !== id)].slice(0, MAX_RECENT_THEMES)
    set({ recentThemeIds })
    writeRecentThemeIds(recentThemeIds)
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
