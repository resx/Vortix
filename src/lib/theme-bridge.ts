/* ── CSS 变量桥接：从终端配色自动派生 UI 变量 ── */

import type { ITheme } from '@xterm/xterm'
import type { ThemeUIOverrides } from '../types/theme'

/** 解析 hex 颜色为 RGB 分量 */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '').slice(0, 6)
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** RGB 分量转 hex */
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return `#${[r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`
}

/** 计算相对亮度 (0-1) */
function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 判断颜色是否为暗色 */
export function isDarkColor(hex: string): boolean {
  return luminance(hex) < 0.5
}

/** 调整亮度：amount > 0 变亮，< 0 变暗 */
function adjustBrightness(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex)
  const factor = 1 + amount
  return toHex(r * factor, g * factor, b * factor)
}

/** 混合两个颜色 */
function mixColors(hex1: string, hex2: string, weight: number): string {
  const [r1, g1, b1] = parseHex(hex1)
  const [r2, g2, b2] = parseHex(hex2)
  const w = Math.max(0, Math.min(1, weight))
  return toHex(
    r1 * (1 - w) + r2 * w,
    g1 * (1 - w) + g2 * w,
    b1 * (1 - w) + b2 * w,
  )
}

/** hex 附加 alpha 通道 */
function hexAlpha(hex: string, alpha: number): string {
  const base = hex.replace('#', '').slice(0, 6)
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${base}${a}`
}

/** 默认关键词高亮配色 */
export const DEFAULT_HIGHLIGHTS = {
  error: '#F44747',
  warning: '#E6A23C',
  ok: '#6A9955',
  info: '#569CD6',
  debug: '#808080',
  ipMac: '#CE9178',
  path: '#4EC9B0',
  url: '#569CD6',
  timestamp: '#DCDCAA',
  env: '#C586C0',
} as const

/**
 * 从终端配色自动派生 UI CSS 变量
 * 当主题未提供 ui overrides 时使用此算法
 */
export function deriveUIVars(
  terminal: ITheme,
  overrides?: ThemeUIOverrides,
): Required<ThemeUIOverrides> {
  const bg = terminal.background ?? '#1E1E1E'
  const fg = terminal.foreground ?? '#D4D4D4'
  const dark = isDarkColor(bg)

  const derived: Required<ThemeUIOverrides> = {
    bgBase: dark ? adjustBrightness(bg, -0.08) : adjustBrightness(bg, 0.02),
    bgCard: dark ? adjustBrightness(bg, 0.06) : '#FFFFFF',
    bgSubtle: dark ? adjustBrightness(bg, 0.1) : adjustBrightness(bg, -0.02),
    bgHover: dark ? adjustBrightness(bg, 0.15) : adjustBrightness(bg, -0.04),
    primary: terminal.blue ?? (dark ? '#5B8FFF' : '#4080FF'),
    border: dark
      ? mixColors(bg, fg, 0.15)
      : mixColors(bg, fg, 0.12),
    text1: dark ? adjustBrightness(fg, 0.1) : adjustBrightness(fg, -0.1),
    text2: mixColors(fg, bg, 0.3),
    text3: mixColors(fg, bg, 0.5),
  }

  // 用户覆盖优先
  if (overrides) {
    for (const key of Object.keys(overrides) as (keyof ThemeUIOverrides)[]) {
      if (overrides[key]) {
        derived[key] = overrides[key]!
      }
    }
  }

  return derived
}

/** CSS 变量名映射 */
const CSS_VAR_MAP: Record<keyof Required<ThemeUIOverrides>, string> = {
  bgBase: '--bg-base',
  bgCard: '--bg-card',
  bgSubtle: '--bg-subtle',
  bgHover: '--bg-hover',
  primary: '--primary',
  border: '--border',
  text1: '--text-1',
  text2: '--text-2',
  text3: '--text-3',
}

/** 将派生的 UI 变量应用到 document root */
export function applyThemeVars(
  terminal: ITheme,
  overrides?: ThemeUIOverrides,
): void {
  const vars = deriveUIVars(terminal, overrides)
  const root = document.documentElement

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const value = vars[key as keyof Required<ThemeUIOverrides>]
    if (value) {
      root.style.setProperty(cssVar, value)
    }
  }

  // 终端专用变量
  root.style.setProperty('--term-bg', terminal.background ?? '#1E1E1E')
  root.style.setProperty('--term-text', terminal.foreground ?? '#D4D4D4')
  root.style.setProperty('--term-caret', terminal.cursor ?? terminal.foreground ?? '#D4D4D4')

  // 暗色模式 class 同步
  const bg = terminal.background ?? '#1E1E1E'
  if (isDarkColor(bg)) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // border-subtle 派生
  const borderBase = vars.border
  root.style.setProperty('--border-subtle', hexAlpha(borderBase, 0.6))

  // primary-bg 派生
  const primaryBg = isDarkColor(bg)
    ? mixColors(bg, vars.primary, 0.15)
    : mixColors('#FFFFFF', vars.primary, 0.08)
  root.style.setProperty('--primary-bg', primaryBg)
  root.style.setProperty('--bg-active', primaryBg)
}

/** 清除所有主题自定义 CSS 变量，恢复 CSS 默认值 */
export function clearThemeVars(): void {
  const root = document.documentElement
  for (const cssVar of Object.values(CSS_VAR_MAP)) {
    root.style.removeProperty(cssVar)
  }
  root.style.removeProperty('--term-bg')
  root.style.removeProperty('--term-text')
  root.style.removeProperty('--term-caret')
  root.style.removeProperty('--border-subtle')
  root.style.removeProperty('--primary-bg')
  root.style.removeProperty('--bg-active')
}
