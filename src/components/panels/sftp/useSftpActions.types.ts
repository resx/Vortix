import type { SftpSessionId } from '../../../stores/useSftpStore'
import type { ExecResult } from '../../../types/sftp'

export interface SftpConnection {
  refresh: () => void
  listDir: (path: string) => Promise<void>
  mkdir: (path: string) => Promise<void>
  rename: (oldPath: string, newPath: string) => Promise<void>
  remove: (path: string, isDir: boolean) => Promise<void>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  chmod: (path: string, mode: string, recursive?: boolean) => Promise<void>
  touch: (path: string, isDir?: boolean) => Promise<void>
  exec: (command: string) => Promise<ExecResult>
  send: (type: string, data?: unknown) => void
}

export interface UseSftpActionsParams {
  sessionId: SftpSessionId
  sftp: SftpConnection
  targetTabId: string | null
  openEditor: (path: string, content: string) => void
}
