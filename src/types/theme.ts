/* ── 统一主题类型定义 ── */

import type { ITheme } from '@xterm/xterm'

/** 主题来源 */
export type ThemeSource = 'builtin' | 'custom' | 'imported'

/** 关键词高亮配色 */
export interface ThemeHighlights {
  error: string
  warning: string
  ok: string
  info: string
  debug: string
  ipMac: string
  path: string
  url: string
  timestamp: string
  env: string
}

/** UI 变量覆盖（可选，缺省时从 terminal 自动派生） */
export interface ThemeUIOverrides {
  bgBase?: string
  bgCard?: string
  bgSubtle?: string
  bgHover?: string
  primary?: string
  border?: string
  text1?: string
  text2?: string
  text3?: string
}

/** 统一主题定义 */
export interface VortixTheme {
  id: string
  name: string
  mode: 'light' | 'dark'
  version: 1
  source: ThemeSource
  author?: string
  createdAt?: string
  updatedAt?: string

  /** 终端配色（xterm ITheme 兼容） */
  terminal: ITheme

  /** 关键词高亮 */
  highlights: ThemeHighlights

  /** UI 变量覆盖 */
  ui?: ThemeUIOverrides
}

/** 创建自定义主题 DTO */
export interface CreateThemeDto {
  name: string
  mode: 'light' | 'dark'
  terminal: ITheme
  highlights?: Partial<ThemeHighlights>
  ui?: ThemeUIOverrides
  author?: string
}

/** 更新自定义主题 DTO */
export interface UpdateThemeDto {
  name?: string
  terminal?: ITheme
  highlights?: Partial<ThemeHighlights>
  ui?: ThemeUIOverrides
}

/** 导出格式 */
export interface VortixThemeExport {
  format: 'vortix-theme-v1'
  theme: Omit<VortixTheme, 'source' | 'createdAt' | 'updatedAt'>
}

/* ── EOF ── */
