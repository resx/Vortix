import { getCurrentWindow, currentMonitor as tauriCurrentMonitor, primaryMonitor as tauriPrimaryMonitor, LogicalSize, LogicalPosition } from '@tauri-apps/api/window'
import { LazyStore } from '@tauri-apps/plugin-store'

const store = new LazyStore('.window-state.dat')
const MIN_WIDTH = 1100
const MIN_HEIGHT = 700
const STARTUP_SAVE_LOCK_MS = 2000

let startupSaveLocked = true

interface WindowState {
  width: number
  height: number
  x: number
  y: number
  scaleFactor?: number
  maximized?: boolean
  mode?: 'logical' | 'physical'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidState(state: WindowState | null | undefined): state is WindowState {
  return !!state && [state.width, state.height, state.x, state.y].every(isFiniteNumber)
}

function normalizeState(state: WindowState, fallbackScaleFactor: number) {
  const scaleFactor = state.scaleFactor && state.scaleFactor > 0 ? state.scaleFactor : fallbackScaleFactor
  const divisor = state.mode === 'logical' ? 1 : scaleFactor

  return {
    width: state.width / divisor,
    height: state.height / divisor,
    x: state.x / divisor,
    y: state.y / divisor,
    maximized: Boolean(state.maximized),
  }
}

export async function saveWindowState() {
  const window = getCurrentWindow()
  const [size, position, scaleFactor, minimized, maximized] = await Promise.all([
    window.innerSize(),
    window.innerPosition(),
    window.scaleFactor(),
    window.isMinimized(),
    window.isMaximized(),
  ])

  if (minimized || scaleFactor <= 0) return

  const logicalWidth = size.width / scaleFactor
  const logicalHeight = size.height / scaleFactor
  const logicalX = position.x / scaleFactor
  const logicalY = position.y / scaleFactor

  if (!Number.isFinite(logicalWidth) || !Number.isFinite(logicalHeight) || logicalWidth < MIN_WIDTH * 0.5 || logicalHeight < MIN_HEIGHT * 0.5) {
    return
  }

  const state: WindowState = {
    width: logicalWidth,
    height: logicalHeight,
    x: logicalX,
    y: logicalY,
    scaleFactor,
    maximized,
    mode: 'logical',
  }
  await store.set('window-state', state)
  await store.save()
}

export async function restoreWindowState(): Promise<boolean> {
  try {
    const state = await store.get<WindowState>('window-state')
    if (!isValidState(state)) return false

    const window = getCurrentWindow()
    const monitor = (await tauriCurrentMonitor()) ?? (await tauriPrimaryMonitor())
    const fallbackScaleFactor = monitor?.scaleFactor ?? (await window.scaleFactor())
    const normalizedState = normalizeState(state, fallbackScaleFactor)

    if (!Number.isFinite(normalizedState.width) || !Number.isFinite(normalizedState.height)) {
      return false
    }

    if (monitor) {
      const scaleFactor = monitor.scaleFactor || fallbackScaleFactor
      const workArea = monitor.workArea
      const workAreaWidth = workArea.size.width / scaleFactor
      const workAreaHeight = workArea.size.height / scaleFactor
      const workAreaX = workArea.position.x / scaleFactor
      const workAreaY = workArea.position.y / scaleFactor

      const minWidth = Math.min(MIN_WIDTH, workAreaWidth)
      const minHeight = Math.min(MIN_HEIGHT, workAreaHeight)
      const safeW = clamp(normalizedState.width, minWidth, workAreaWidth)
      const safeH = clamp(normalizedState.height, minHeight, workAreaHeight)

      const maxX = workAreaX + workAreaWidth - safeW
      const maxY = workAreaY + workAreaHeight - safeH
      const defaultX = workAreaX + Math.max(0, (workAreaWidth - safeW) / 2)
      const defaultY = workAreaY + Math.max(0, (workAreaHeight - safeH) / 2)
      const safeX = maxX >= workAreaX ? clamp(normalizedState.x, workAreaX, maxX) : defaultX
      const safeY = maxY >= workAreaY ? clamp(normalizedState.y, workAreaY, maxY) : defaultY

      await window.setSize(new LogicalSize(safeW, safeH))
      await window.setPosition(new LogicalPosition(safeX, safeY))
    } else {
      await window.setSize(new LogicalSize(Math.max(normalizedState.width, MIN_WIDTH), Math.max(normalizedState.height, MIN_HEIGHT)))
      await window.center()
    }

    if (normalizedState.maximized) {
      await window.maximize()
    }

    startupSaveLocked = true
    globalThis.setTimeout(() => {
      startupSaveLocked = false
    }, STARTUP_SAVE_LOCK_MS)
    return true
  } catch (e) {
    console.warn('[Vortix] 恢复窗口状态失败:', e)
    return false
  }
}

export function setupWindowStateListener() {
  let timer: number | undefined

  const onStateChange = () => {
    if (startupSaveLocked) return
    if (timer) clearTimeout(timer)
    timer = globalThis.setTimeout(() => {
      void saveWindowState()
    }, 500)
  }

  const tauriWindow = getCurrentWindow()
  void tauriWindow.onResized(onStateChange)
  void tauriWindow.onMoved(onStateChange)
  void tauriWindow.onScaleChanged(onStateChange)
  void tauriWindow.onCloseRequested(async () => {
    startupSaveLocked = false
    await saveWindowState()
  })

  globalThis.setTimeout(() => {
    startupSaveLocked = false
  }, STARTUP_SAVE_LOCK_MS)
}
