import type { ITheme } from '@xterm/xterm'

export type ThemeSource = 'builtin' | 'custom' | 'imported'

export type ThemePreviewScenario =
  | 'shell'
  | 'logs'
  | 'git-diff'
  | 'trace'
  | 'ssh'
  | 'unfocused'

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

export interface ThemeMeta {
  family?: string
  pairId?: string
  tags?: string[]
  originality?: 'original' | 'compatible'
  contrastScore?: number
}

export interface ThemeBehavior {
  cursorStyle?: 'block' | 'underline' | 'bar'
  cursorBlink?: boolean
  minimumContrastRatio?: number
  inactiveDimOpacity?: number
  showSessionBadge?: boolean
  showRiskStrip?: boolean
}

export interface ThemeAnalysisIssue {
  level: 'error' | 'warning' | 'info'
  code:
    | 'low-contrast-foreground'
    | 'low-contrast-cursor'
    | 'low-contrast-selection'
    | 'missing-selection'
    | 'ansi-too-similar'
    | 'missing-bright-colors'
    | 'ui-terminal-drift'
  message: string
  field?: string
}

export interface ThemeAnalysisResult {
  score: number
  contrastScore: number
  distinctivenessScore: number
  consistencyScore: number
  issues: ThemeAnalysisIssue[]
  changedFields: string[]
}

export interface VortixTheme {
  id: string
  name: string
  mode: 'light' | 'dark'
  version: 1
  source: ThemeSource
  author?: string
  createdAt?: string
  updatedAt?: string
  terminal: ITheme
  highlights: ThemeHighlights
  ui?: ThemeUIOverrides
  meta?: ThemeMeta
  behavior?: ThemeBehavior
  baseThemeId?: string
}

export interface CreateThemeDto {
  name: string
  mode: 'light' | 'dark'
  terminal: ITheme
  highlights?: Partial<ThemeHighlights>
  ui?: ThemeUIOverrides
  meta?: ThemeMeta
  behavior?: ThemeBehavior
  baseThemeId?: string
  author?: string
}

export interface UpdateThemeDto {
  name?: string
  terminal?: ITheme
  highlights?: Partial<ThemeHighlights>
  ui?: ThemeUIOverrides
  meta?: ThemeMeta
  behavior?: ThemeBehavior
  baseThemeId?: string
}

export interface VortixThemeExport {
  format: 'vortix-theme-v1'
  theme: Omit<VortixTheme, 'source' | 'createdAt' | 'updatedAt'>
}
