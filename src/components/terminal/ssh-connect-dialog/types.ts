import type { Folder } from '../../../api/types'

export type DialogMode = 'quick' | 'save' | 'edit'

export interface SshConnectInitialData {
  id?: string
  name?: string
  folder_id?: string | null
  host?: string
  port?: number
  username?: string
  auth_method?: 'password' | 'key'
  remark?: string
}

export interface SshConnectDialogProps {
  open: boolean
  mode: DialogMode
  onClose: () => void
  initialData?: SshConnectInitialData
}

export interface SshConnectDialogState {
  name: string
  folderId: string | null
  host: string
  port: string
  username: string
  authType: 'password' | 'key'
  password: string
  privateKey: string
  remark: string
  showPassword: boolean
  folders: Folder[]
  saving: boolean
}
