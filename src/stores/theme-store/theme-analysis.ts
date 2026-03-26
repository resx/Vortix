import type { ITheme } from '@xterm/xterm'
import type {
  ThemeAnalysisIssue,
  ThemeAnalysisResult,
  VortixTheme,
} from '../../types/theme'

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

export function contrastRatio(fg?: string, bg?: string): number | null {
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

export function analyzeVortixTheme(theme: VortixTheme, baseline?: VortixTheme): ThemeAnalysisResult {
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

export function buildContrastSafeTheme(theme: VortixTheme): VortixTheme {
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
