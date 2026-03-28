import type { ITheme } from '@xterm/xterm'
import type { ThemeHighlights } from '../../../../types/theme'

export const PRIMARY_TERMINAL_FIELDS: ReadonlyArray<{ field: keyof ITheme; label: string }> = [
  { field: 'background', label: 'themeWorkbench.inspector.background' },
  { field: 'foreground', label: 'themeWorkbench.inspector.foreground' },
  { field: 'cursor', label: 'themeWorkbench.inspector.cursor' },
  { field: 'selectionBackground', label: 'themeWorkbench.inspector.selection' },
]

export const SECONDARY_TERMINAL_FIELDS: ReadonlyArray<{ field: keyof ITheme; label: string }> = [
  { field: 'red', label: 'themeWorkbench.inspector.ansiRed' },
  { field: 'green', label: 'themeWorkbench.inspector.ansiGreen' },
  { field: 'blue', label: 'themeWorkbench.inspector.ansiBlue' },
  { field: 'yellow', label: 'themeWorkbench.inspector.ansiYellow' },
]

export const HIGHLIGHT_FIELDS: ReadonlyArray<{ field: keyof ThemeHighlights; label: string }> = [
  { field: 'error', label: 'themeWorkbench.inspector.highlightError' },
  { field: 'info', label: 'themeWorkbench.inspector.highlightInfo' },
]

export function getIssueMessage(
  t: (key: string, params?: Record<string, string | number>) => string,
  code: string,
): string {
  return t(`themeWorkbench.quality.issue.${code}`)
}
