import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { TerminalSession } from '../../../stores/terminalSessionRegistry'

interface XtermInternalCore {
  _renderService?: {
    clear?: () => void
    dimensions?: {
      css?: {
        cell?: {
          width?: number
          height?: number
        }
      }
    }
  }
}

const TERMINAL_VIEWPORT_SAFE_INSET_PX = 4

function parseCssPixelValue(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getProposedTerminalDimensions(
  wrapperEl: HTMLDivElement | null,
  term: Terminal,
  fitAddon?: FitAddon,
): { cols: number; rows: number } | undefined {
  if (!wrapperEl || wrapperEl.clientWidth <= 0 || wrapperEl.clientHeight <= 0) return undefined

  const css = ((term as Terminal & { _core?: XtermInternalCore })._core?._renderService?.dimensions?.css)
  const cellWidth = css?.cell?.width ?? 0
  const cellHeight = css?.cell?.height ?? 0
  if (cellWidth <= 0 || cellHeight <= 0) {
    try {
      return fitAddon?.proposeDimensions() ?? undefined
    } catch {
      return undefined
    }
  }

  const containerStyle = window.getComputedStyle(wrapperEl)
  const termStyle = term.element ? window.getComputedStyle(term.element) : null
  const paddingTop = parseCssPixelValue(termStyle?.getPropertyValue('padding-top'))
  const paddingBottom = parseCssPixelValue(termStyle?.getPropertyValue('padding-bottom'))
  const paddingLeft = parseCssPixelValue(termStyle?.getPropertyValue('padding-left'))
  const paddingRight = parseCssPixelValue(termStyle?.getPropertyValue('padding-right'))
  const height = parseCssPixelValue(containerStyle.getPropertyValue('height'))
  const width = Math.max(0, parseCssPixelValue(containerStyle.getPropertyValue('width')))
  const overviewRulerWidth = term.options.scrollback === 0 ? 0 : term.options.overviewRuler?.width || 14
  const availableHeight = Math.max(0, height - paddingTop - paddingBottom - TERMINAL_VIEWPORT_SAFE_INSET_PX)
  const availableWidth = Math.max(0, width - paddingLeft - paddingRight - overviewRulerWidth)

  return {
    cols: Math.max(2, Math.floor(availableWidth / cellWidth)),
    rows: Math.max(1, Math.floor(availableHeight / cellHeight)),
  }
}

export function fitTerminalSession(wrapperEl: HTMLDivElement | null, session: TerminalSession): void {
  if (!wrapperEl || wrapperEl.clientWidth <= 0 || wrapperEl.clientHeight <= 0) return
  const dims = getProposedTerminalDimensions(wrapperEl, session.term, session.fitAddon)
  if (!dims) return
  if (session.term.cols === dims.cols && session.term.rows === dims.rows) return
  try {
    (session.term as Terminal & { _core?: XtermInternalCore })._core?._renderService?.clear?.()
  } catch {
    // 静默处理 xterm 内部实现差异
  }
  try {
    session.term.resize(dims.cols, dims.rows)
  } catch {
    // 静默处理极端时序下的 resize 异常
  }
}

export function readTerminalCellHeight(term: Terminal): number {
  try {
    return ((term as Terminal & { _core?: XtermInternalCore })._core?._renderService?.dimensions?.css?.cell?.height) ?? 0
  } catch {
    return 0
  }
}

export function stabilizeTerminalSessionLayout(
  wrapperEl: HTMLDivElement | null,
  session: TerminalSession,
  options?: {
    preferredFont?: string
    onLayoutApplied?: () => void
  },
): void {
  const run = () => {
    fitTerminalSession(wrapperEl, session)
    session.term.refresh(0, session.term.rows - 1)
    const dims = getProposedTerminalDimensions(wrapperEl, session.term, session.fitAddon)
    if (dims && session.ws?.readyState === WebSocket.OPEN) {
      session.ws.send(JSON.stringify({ type: 'resize', data: { cols: dims.cols, rows: dims.rows } }))
    }
    options?.onLayoutApplied?.()
  }

  run()
  requestAnimationFrame(() => requestAnimationFrame(run))
  window.setTimeout(run, 120)

  if (document.fonts?.ready) {
    void document.fonts.ready.then(run).catch(() => {})
  }
  if (options?.preferredFont && document.fonts?.load) {
    void document.fonts.load(`${session.term.options.fontSize ?? 14}px ${options.preferredFont}`)
      .then(run)
      .catch(() => {})
  }
}
