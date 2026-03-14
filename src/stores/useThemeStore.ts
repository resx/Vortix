/* ── 统一主题注册表 Store ── */

import { create } from 'zustand'
import type { ITheme } from '@xterm/xterm'
import type { VortixTheme, ThemeHighlights } from '../types/theme'
import { DARK_THEMES } from '../components/terminal/themes/dark-themes'
import { LIGHT_THEMES } from '../components/terminal/themes/light-themes'
import { DEFAULT_HIGHLIGHTS } from '../lib/theme-bridge'
import * as api from '../api/client'
import type { CustomThemePublic } from '../api/types'

/** 将旧版 TermThemePreset 转为 VortixTheme */
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
  }
}

/** 将后端 CustomThemePublic 转为 VortixTheme */
function customToVortix(row: CustomThemePublic): VortixTheme {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    version: 1,
    source: 'custom',
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    terminal: row.terminal as ITheme,
    highlights: row.highlights as ThemeHighlights,
    ui: row.ui as VortixTheme['ui'],
  }
}

/** 内置主题（启动时一次性转换） */
const BUILTIN_THEMES: VortixTheme[] = [
  ...DARK_THEMES.map(presetToVortix),
  ...LIGHT_THEMES.map(presetToVortix),
]

const BUILTIN_MAP = new Map<string, VortixTheme>(
  BUILTIN_THEMES.map(t => [t.id, t]),
)

interface ThemeStore {
  /** 自定义主题列表 */
  customThemes: VortixTheme[]
  /** 加载状态 */
  loaded: boolean

  /** 获取全部主题（builtin + custom） */
  getAllThemes: () => VortixTheme[]
  /** 按 mode 筛选 */
  getThemesByMode: (mode: 'light' | 'dark') => VortixTheme[]
  /** 根据 ID 查找（O(1) builtin + 线性 custom） */
  getThemeById: (id: string) => VortixTheme | undefined
  /** 从后端加载自定义主题 */
  loadCustomThemes: () => Promise<void>
  /** 创建自定义主题 */
  createTheme: (data: Omit<VortixTheme, 'id' | 'source' | 'version' | 'createdAt' | 'updatedAt'>) => Promise<VortixTheme>
  /** 更新自定义主题 */
  updateTheme: (id: string, data: Partial<Pick<VortixTheme, 'name' | 'mode' | 'terminal' | 'highlights' | 'ui'>>) => Promise<VortixTheme | undefined>
  /** 删除自定义主题 */
  deleteTheme: (id: string) => Promise<boolean>
  /** 导入主题（支持多格式） */
  importThemes: (raw: string) => Promise<{ count: number; errors: string[] }>
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  customThemes: [],
  loaded: false,

  getAllThemes: () => {
    return [...BUILTIN_THEMES, ...get().customThemes]
  },

  getThemesByMode: (mode) => {
    return get().getAllThemes().filter(t => t.mode === mode)
  },

  getThemeById: (id) => {
    // 先查 builtin（O(1)），再查 custom
    const builtin = BUILTIN_MAP.get(id)
    if (builtin) return builtin
    return get().customThemes.find(t => t.id === id)
  },

  loadCustomThemes: async () => {
    try {
      const rows = await api.getCustomThemes()
      const themes = rows.map(customToVortix)
      set({ customThemes: themes, loaded: true })
    } catch (e) {
      console.error('[Vortix] 加载自定义主题失败', e)
      set({ loaded: true })
    }
  },

  createTheme: async (data) => {
    const row = await api.createCustomTheme({
      name: data.name,
      mode: data.mode,
      terminal: data.terminal as Record<string, string | undefined>,
      highlights: data.highlights as Record<string, string>,
      ui: data.ui as Record<string, string>,
      author: data.author,
    })
    const theme = customToVortix(row)
    set(s => ({ customThemes: [...s.customThemes, theme] }))
    return theme
  },

  updateTheme: async (id, data) => {
    try {
      const row = await api.updateCustomTheme(id, {
        name: data.name,
        mode: data.mode,
        terminal: data.terminal as Record<string, string | undefined>,
        highlights: data.highlights as Record<string, string>,
        ui: data.ui as Record<string, string>,
      })
      const theme = customToVortix(row)
      set(s => ({
        customThemes: s.customThemes.map(t => t.id === id ? theme : t),
      }))
      return theme
    } catch {
      return undefined
    }
  },

  deleteTheme: async (id) => {
    try {
      await api.deleteCustomTheme(id)
      set(s => ({
        customThemes: s.customThemes.filter(t => t.id !== id),
      }))
      return true
    } catch {
      return false
    }
  },

  importThemes: async (raw) => {
    try {
      const result = await api.importThemes(raw)
      const themes = result.themes.map(customToVortix)
      set(s => ({
        customThemes: [...s.customThemes, ...themes],
      }))
      return { count: themes.length, errors: result.errors }
    } catch (e) {
      return { count: 0, errors: [(e as Error).message] }
    }
  },
}))
