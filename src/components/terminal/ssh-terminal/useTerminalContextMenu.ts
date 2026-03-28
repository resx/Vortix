import { useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { getSession } from '../../../stores/terminalSessionRegistry'
import { pasteTextToSession } from '../session/terminal-paste'

interface UseTerminalContextMenuOptions {
  paneId: string
  onContextMenu?: (x: number, y: number, hasSelection: boolean) => void
}

export function useTerminalContextMenu({ paneId, onContextMenu }: UseTerminalContextMenuOptions) {
  return useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const action = useSettingsStore.getState().termRightClickAction
    if (action === 'none') return

    const session = getSession(paneId)
    const selection = session?.term.getSelection()
    const paste = () => {
      navigator.clipboard.readText().then((text) => {
        pasteTextToSession(paneId, text)
      }).catch(() => {})
    }

    if (action === 'copy') {
      if (selection) navigator.clipboard.writeText(selection).catch(() => {})
      return
    }
    if (action === 'paste') {
      paste()
      return
    }
    if (action === 'copy-paste') {
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {})
      } else {
        paste()
      }
      return
    }

    onContextMenu?.(event.clientX, event.clientY, !!selection)
  }, [onContextMenu, paneId])
}
