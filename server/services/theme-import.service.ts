/* ── 主题导入解析服务 ── */

import type { CustomTheme } from '../types/index.js'

/** 导入来源格式 */
type ImportFormat = 'vortix' | 'windows-terminal' | 'iterm2' | 'unknown'

/** 导入结果 */
interface ImportResult {
  format: ImportFormat
  themes: Omit<CustomTheme, 'id' | 'created_at' | 'updated_at'>[]
  errors: string[]
}

/** 检测导入格式 */
function detectFormat(data: unknown): ImportFormat {
  if (!data || typeof data !== 'object') return 'unknown'
  const obj = data as Record<string, unknown>

  // Vortix 导出格式
  if (obj.format === 'vortix-theme-v1') return 'vortix'

  // Windows Terminal 格式（含 schemes 数组）
  if (Array.isArray(obj.schemes)) return 'windows-terminal'
  // 单个 Windows Terminal scheme
  if (typeof obj.background === 'string' && typeof obj.foreground === 'string' && typeof obj.name === 'string') {
    return 'windows-terminal'
  }

  // iTerm2 plist 格式（含 Ansi 0 Color 等键）
  if (obj['Ansi 0 Color'] || obj['Background Color']) return 'iterm2'

  return 'unknown'
}

/** 默认关键词高亮 */
const DEFAULT_HIGHLIGHTS: Record<string, string> = {
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
}

/** 判断颜色是否为暗色 */
function isDark(hex: string): boolean {
  const h = hex.replace('#', '').slice(0, 6)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5
}

/** 解析 Vortix 导出格式 */
function parseVortix(data: Record<string, unknown>): ImportResult {
  const errors: string[] = []
  const theme = data.theme as Record<string, unknown> | undefined
  if (!theme) {
    return { format: 'vortix', themes: [], errors: ['缺少 theme 字段'] }
  }

  return {
    format: 'vortix',
    themes: [{
      name: (theme.name as string) ?? 'Imported Theme',
      mode: (theme.mode as 'light' | 'dark') ?? 'dark',
      version: 1,
      author: (theme.author as string) ?? '',
      terminal: (theme.terminal ?? {}) as Record<string, string | undefined>,
      highlights: { ...DEFAULT_HIGHLIGHTS, ...((theme.highlights ?? {}) as Record<string, string>) },
      ui: theme.ui as Record<string, string> | undefined,
    }],
    errors,
  }
}

/** 解析 Windows Terminal scheme */
function parseWindowsTerminal(data: unknown): ImportResult {
  const errors: string[] = []
  const schemes: Record<string, unknown>[] = []

  if (Array.isArray((data as Record<string, unknown>).schemes)) {
    schemes.push(...(data as Record<string, unknown>).schemes as Record<string, unknown>[])
  } else if (typeof data === 'object' && data !== null) {
    schemes.push(data as Record<string, unknown>)
  }

  const themes = schemes.map(s => {
    const bg = (s.background as string) ?? '#0C0C0C'
    return {
      name: (s.name as string) ?? 'Windows Terminal Theme',
      mode: isDark(bg) ? 'dark' as const : 'light' as const,
      version: 1 as const,
      author: '',
      terminal: {
        background: bg,
        foreground: (s.foreground as string) ?? '#CCCCCC',
        cursor: (s.cursorColor as string) ?? (s.foreground as string) ?? '#CCCCCC',
        selectionBackground: (s.selectionBackground as string) ?? undefined,
        black: s.black as string,
        red: s.red as string,
        green: s.green as string,
        yellow: s.yellow as string,
        blue: s.blue as string,
        magenta: (s.purple as string) ?? (s.magenta as string),
        cyan: s.cyan as string,
        white: s.white as string,
        brightBlack: s.brightBlack as string,
        brightRed: s.brightRed as string,
        brightGreen: s.brightGreen as string,
        brightYellow: s.brightYellow as string,
        brightBlue: s.brightBlue as string,
        brightMagenta: (s.brightPurple as string) ?? (s.brightMagenta as string),
        brightCyan: s.brightCyan as string,
        brightWhite: s.brightWhite as string,
      } as Record<string, string | undefined>,
      highlights: { ...DEFAULT_HIGHLIGHTS },
    }
  })

  return { format: 'windows-terminal', themes, errors }
}

/** 将 iTerm2 plist 颜色组件转为 hex */
function itermColorToHex(colorObj: Record<string, unknown>): string {
  const r = Math.round(((colorObj['Red Component'] as number) ?? 0) * 255)
  const g = Math.round(((colorObj['Green Component'] as number) ?? 0) * 255)
  const b = Math.round(((colorObj['Blue Component'] as number) ?? 0) * 255)
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`
}

/** 解析 iTerm2 配色方案 */
function parseITerm2(data: Record<string, unknown>): ImportResult {
  const errors: string[] = []
  const c = (key: string) => {
    const obj = data[key] as Record<string, unknown> | undefined
    return obj ? itermColorToHex(obj) : undefined
  }

  const bg = c('Background Color') ?? '#000000'
  const fg = c('Foreground Color') ?? '#FFFFFF'

  const terminal: Record<string, string | undefined> = {
    background: bg,
    foreground: fg,
    cursor: c('Cursor Color'),
    selectionBackground: c('Selection Color'),
    black: c('Ansi 0 Color'),
    red: c('Ansi 1 Color'),
    green: c('Ansi 2 Color'),
    yellow: c('Ansi 3 Color'),
    blue: c('Ansi 4 Color'),
    magenta: c('Ansi 5 Color'),
    cyan: c('Ansi 6 Color'),
    white: c('Ansi 7 Color'),
    brightBlack: c('Ansi 8 Color'),
    brightRed: c('Ansi 9 Color'),
    brightGreen: c('Ansi 10 Color'),
    brightYellow: c('Ansi 11 Color'),
    brightBlue: c('Ansi 12 Color'),
    brightMagenta: c('Ansi 13 Color'),
    brightCyan: c('Ansi 14 Color'),
    brightWhite: c('Ansi 15 Color'),
  }

  return {
    format: 'iterm2',
    themes: [{
      name: 'iTerm2 Theme',
      mode: isDark(bg) ? 'dark' : 'light',
      version: 1,
      author: '',
      terminal,
      highlights: { ...DEFAULT_HIGHLIGHTS },
    }],
    errors,
  }
}

/** 统一导入入口 */
export function importTheme(raw: string): ImportResult {
  try {
    const data = JSON.parse(raw)
    const format = detectFormat(data)

    switch (format) {
      case 'vortix':
        return parseVortix(data)
      case 'windows-terminal':
        return parseWindowsTerminal(data)
      case 'iterm2':
        return parseITerm2(data)
      default:
        return { format: 'unknown', themes: [], errors: ['无法识别的主题格式'] }
    }
  } catch (e) {
    return { format: 'unknown', themes: [], errors: [`JSON 解析失败: ${(e as Error).message}`] }
  }
}

/** 导出为 Vortix 格式 */
export function exportTheme(theme: CustomTheme): string {
  return JSON.stringify({
    format: 'vortix-theme-v1',
    theme: {
      id: theme.id,
      name: theme.name,
      mode: theme.mode,
      version: theme.version,
      author: theme.author,
      terminal: theme.terminal,
      highlights: theme.highlights,
      ui: theme.ui,
    },
  }, null, 2)
}
