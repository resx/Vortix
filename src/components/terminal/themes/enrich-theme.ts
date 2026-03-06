import type { ITheme } from '@xterm/xterm'

/**
 * 将 6 位 hex 颜色附加 alpha 通道（0-1），返回 8 位 hex
 * 例: hexWithAlpha('#FF0000', 0.5) → '#FF000080'
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const base = hex.replace('#', '').slice(0, 6)
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${base}${a}`
}

/**
 * 自动补全 ITheme 缺失字段，只填充 undefined 字段，不覆盖已有值
 * 提升所有预设主题的渲染质量（光标、选区、滚动条等）
 */
export function enrichTheme(theme: ITheme): ITheme {
  const bg = theme.background ?? '#000000'
  const fg = theme.foreground ?? '#FFFFFF'
  const selBg = theme.selectionBackground

  return {
    ...theme,
    cursorAccent: theme.cursorAccent ?? bg,
    selectionInactiveBackground:
      theme.selectionInactiveBackground ??
      (selBg ? hexWithAlpha(selBg, 0.4) : hexWithAlpha(fg, 0.15)),
    scrollbarSliderBackground:
      theme.scrollbarSliderBackground ?? hexWithAlpha(fg, 0.2),
    scrollbarSliderHoverBackground:
      theme.scrollbarSliderHoverBackground ?? hexWithAlpha(fg, 0.4),
    scrollbarSliderActiveBackground:
      theme.scrollbarSliderActiveBackground ?? hexWithAlpha(fg, 0.5),
    overviewRulerBorder:
      theme.overviewRulerBorder ?? hexWithAlpha(fg, 0.25),
  }
}
