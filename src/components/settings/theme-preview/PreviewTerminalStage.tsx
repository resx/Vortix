import { cn } from '../../../lib/utils'
import type { ThemePreviewScenario, VortixTheme } from '../../../types/theme'
import { ensureContrast } from './preview-color-utils'
import { buildPreviewPalette, renderPreviewScenario } from './preview-scenarios'

export function PreviewTerminalStage({
  theme,
  label,
  cursorStyle,
  cursorBlink,
  scenario,
  dimmed = false,
  t,
}: {
  theme: VortixTheme
  label: string
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scenario: ThemePreviewScenario
  dimmed?: boolean
  t: (key: string) => string
}) {
  const terminal = theme.terminal
  const palette = buildPreviewPalette(theme)
  const cursorColor = ensureContrast(terminal.cursor ?? palette.fg, palette.bg, 3)
  const headerLabelColor = ensureContrast(terminal.brightBlack ?? terminal.foreground ?? palette.fg, palette.bg, 4.5)
  const headerThemeNameColor = ensureContrast(terminal.foreground ?? palette.fg, palette.bg, 4.5)
  const textDim = dimmed ? 'opacity-65' : ''
  const cursorClass = cursorBlink ? 'animate-[terminalBlink_1s_step-end_infinite]' : ''

  const cursor = (
    <span
      className={cn('inline-block align-middle', cursorClass)}
      style={{
        backgroundColor: cursorStyle === 'block' ? cursorColor : undefined,
        borderBottom: cursorStyle === 'underline' ? `2px solid ${cursorColor}` : undefined,
        borderLeft: cursorStyle === 'bar' ? `2px solid ${cursorColor}` : undefined,
        width: cursorStyle === 'block' ? 8 : cursorStyle === 'underline' ? 8 : 2,
        height: cursorStyle === 'underline' ? 2 : 14,
      }}
    />
  )

  const content = renderPreviewScenario({
    scenario,
    palette,
    textDim,
    cursor,
    terminal,
    t,
  })

  return (
    <div
      className="flex h-full min-h-[300px] flex-col overflow-hidden rounded-2xl border border-border/60"
      style={{ backgroundColor: palette.bg, color: palette.fg }}
    >
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2 text-[11px] uppercase tracking-[0.12em]">
        <span style={{ color: headerLabelColor }}>{label}</span>
        <span style={{ color: headerThemeNameColor }}>{theme.name}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden px-4 py-4 font-mono text-[12px] leading-[1.7]">
        {content}
      </div>
    </div>
  )
}
