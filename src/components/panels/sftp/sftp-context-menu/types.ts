import type { SftpFileEntry } from '../../../../types/sftp'
import type { SftpSessionId } from '../../../../stores/useSftpStore'

export interface SftpActions {
  handleEdit: (entry: SftpFileEntry) => void
  handleDownload: () => void
  handleUpload: () => void
  handleDelete: (path: string, isDir: boolean) => void
  handleDeleteSelected: () => void
  handleRename: (entry: SftpFileEntry) => void
  handleCopy: () => void
  handleCut: () => void
  handlePaste: () => void
  handleLocate: () => void
  handleCopyPath: (path: string) => void
  handleMkdir: () => void
  handleNewFile: () => void
  handleBookmark: () => void
  handleChmod: (path: string, mode: string, recursive: boolean) => void
  handleNavigate: (path: string) => void
  handleLocalOpen: (entry: SftpFileEntry) => void
  handleDownloadTo: (entry: SftpFileEntry) => void
  handleUploadFolder: () => void
  handleTransferToPeer: () => void
  handleCompress: () => void
  handleDecompress: (entry: SftpFileEntry) => void
  handleScpDownload: () => void
  handleScpUpload: () => void
}

export interface MenuState {
  visible: boolean
  x: number
  y: number
  entry: SftpFileEntry | null
}

export interface SftpContextMenuProps {
  sessionId?: SftpSessionId
  state: MenuState
  actions: SftpActions
  onClose: () => void
  onRefresh?: () => void
  onOpenChmod?: (path: string, permissions: string, isDir: boolean) => void
}
