import type { SshConnectDialogState } from './types'

export const SSH_CONNECT_INPUT_CLASS =
  'w-full border border-border rounded px-3 py-2 text-[13px] text-text-1 placeholder-text-3 outline-none focus:border-primary transition-colors bg-bg-card'

export const DEFAULT_SSH_CONNECT_STATE: SshConnectDialogState = {
  name: '',
  folderId: null,
  host: '',
  port: '22',
  username: 'root',
  authType: 'password',
  password: '',
  privateKey: '',
  remark: '',
  showPassword: false,
  folders: [],
  saving: false,
}
