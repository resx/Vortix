import type { SftpSessionId } from '../../../stores/useSftpStore'
import type { SftpFileEntry } from '../../../types/sftp'

export type PaneSide = 'left' | 'right'
export type PaneHostKind = 'local' | 'ssh'
export type ActivePane = 'local' | 'remote'

export interface MenuState {
  visible: boolean
  x: number
  y: number
  entry: SftpFileEntry | null
  pane: PaneSide
}

export const initialMenuState: MenuState = { visible: false, x: 0, y: 0, entry: null, pane: 'right' }

export function sessionIdFromPane(pane: PaneSide): SftpSessionId {
  return pane
}
