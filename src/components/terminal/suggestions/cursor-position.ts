import type { Terminal } from '@xterm/xterm'

export interface CursorPixelCoords {
  x: number
  y: number
  cellWidth: number
  cellHeight: number
  cursorCol: number
  cursorRow: number
}

interface XtermRenderDimensions {
  css?: {
    cell?: {
      width?: number
      height?: number
    }
  }
}

interface XtermPrivateCore {
  _renderService?: {
    dimensions?: XtermRenderDimensions
  }
}

export function getCursorPixelCoords(term: Terminal): CursorPixelCoords | null {
  const element = term.element
  if (!element) return null

  const core = (term as unknown as { _core?: XtermPrivateCore })._core
  const cellWidth = core?._renderService?.dimensions?.css?.cell?.width ?? 0
  const cellHeight = core?._renderService?.dimensions?.css?.cell?.height ?? 0
  if (!Number.isFinite(cellWidth) || !Number.isFinite(cellHeight) || cellWidth <= 0 || cellHeight <= 0) {
    return null
  }

  const buffer = term.buffer.active
  const cursorCol = buffer.cursorX
  const cursorRow = buffer.cursorY
  const rect = element.getBoundingClientRect()

  return {
    x: rect.left + (cursorCol * cellWidth),
    y: rect.top + ((cursorRow + 1) * cellHeight),
    cellWidth,
    cellHeight,
    cursorCol,
    cursorRow,
  }
}
