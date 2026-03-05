import type { ITheme } from '@xterm/xterm'
import { DARK_THEMES } from './dark-themes'
import { LIGHT_THEMES } from './light-themes'
import { useSettingsStore } from '../../../stores/useSettingsStore'

export interface TermThemePreset {
  id: string
  name: string
  mode: 'light' | 'dark'
  theme: ITheme
}

/** 全部终端主题 */
export const TERM_THEMES: TermThemePreset[] = [...DARK_THEMES, ...LIGHT_THEMES]

/** O(1) 查找 Map */
const THEME_MAP = new Map<string, TermThemePreset>(TERM_THEMES.map(t => [t.id, t]))

/** 按 mode 筛选主题 */
export function getThemesByMode(mode: 'light' | 'dark'): TermThemePreset[] {
  return mode === 'dark' ? DARK_THEMES : LIGHT_THEMES
}

/** 根据 ID 查找主题 */
export function getThemeById(id: string): TermThemePreset | undefined {
  return THEME_MAP.get(id)
}

/**
 * 根据当前明暗模式解析终端主题
 * 从 store 读取 termThemeLight / termThemeDark
 */
export function resolveTermTheme(isDark: boolean): TermThemePreset {
  const { termThemeLight, termThemeDark } = useSettingsStore.getState()
  const id = isDark ? termThemeDark : termThemeLight
  return THEME_MAP.get(id) ?? THEME_MAP.get(isDark ? 'default-dark' : 'default-light')!
}
