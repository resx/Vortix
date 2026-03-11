/* ── CEF 窗口控制预留 ── */
/* 未来 CEF 封装时，通过 window.__VORTIX_WINDOW__ 注入原生方法 */

interface WindowControl {
  minimize: () => void
  maximize: () => void
  close: () => void
  togglePin: () => void
  newWindow?: () => void
  cloneWindow?: (serializedState: string) => void
}

const noop = () => {}

function getWindowControl(): WindowControl {
  const ctrl = (window as unknown as Record<string, unknown>).__VORTIX_WINDOW__ as WindowControl | undefined
  return ctrl || { minimize: noop, maximize: noop, close: noop, togglePin: noop }
}

export function minimizeWindow(): void {
  getWindowControl().minimize()
}

export function maximizeWindow(): void {
  getWindowControl().maximize()
}

export function closeWindow(): void {
  getWindowControl().close()
}

export function togglePinWindow(): void {
  getWindowControl().togglePin()
}

/** 打开新窗口 */
export function openNewWindow(): void {
  const ctrl = getWindowControl()
  if (ctrl.newWindow) {
    ctrl.newWindow()
  } else {
    window.open(window.location.origin, '_blank')
  }
}

/** 复制当前窗口（携带状态） */
export function cloneCurrentWindow(serializedState: string): void {
  const ctrl = getWindowControl()
  if (ctrl.cloneWindow) {
    ctrl.cloneWindow(serializedState)
  } else {
    window.open(`${window.location.origin}?restore=${encodeURIComponent(serializedState)}`, '_blank')
  }
}
