export type AuthType = 'password' | 'privateKey' | 'mfa' | 'preset' | 'jump' | 'agent' | 'none'
export type ProxyType = '关闭' | '自动' | 'SOCKS5' | 'HTTP' | 'HTTPS' | 'SSH跳板'
export type SshConfigTab = '标准' | '隧道' | '代理' | '环境变量' | '高级'

export interface TunnelEntry {
  id: string
  name: string
  type: '本地' | '远程' | '本地SOCKS5' | '远程SOCKS5'
  bindIp: string
  bindPort: string
  targetIp: string
  targetPort: string
  disabled: boolean
}

export interface EnvEntry {
  name: string
  value: string
}

export interface AdvancedSettings {
  sftp: boolean
  lrzsz: boolean
  trzsz: boolean
  sftpSudo: boolean
  x11: boolean
  terminalEnhance: boolean
  pureTerminal: boolean
  recordLog: boolean
  x11Display: string
  sftpCommand: string
  heartbeat: string
  connectTimeout: string
  encoding: string
  terminalType: string
  sftpDefaultPath: string
  expireDate: string
  initCommand: string
}

export type SubModalKey =
  | 'selectKey'
  | 'importKey'
  | 'selectPreset'
  | 'managePreset'
  | 'editTunnel'
  | 'selectAsset'

export interface SshConfigState {
  activeTab: SshConfigTab
  colorTag: string | null
  environment: string
  name: string
  host: string
  user: string
  port: string
  authType: AuthType
  password: string
  privateKeyId: string | null
  privateKeyName: string
  privateKeyPassword: string
  mfaSecret: string
  presetId: string | null
  presetName: string
  jumpKeyId: string | null
  jumpKeyName: string
  jumpKeyPassword: string
  agentSocketPath: string
  remark: string
  tunnels: TunnelEntry[]
  editingTunnel: TunnelEntry | null
  proxyType: ProxyType
  proxyHost: string
  proxyPort: string
  proxyUsername: string
  proxyPassword: string
  proxyTimeout: string
  jumpServerId: string | null
  jumpServerName: string
  envVars: EnvEntry[]
  selectedEnvIndex: number | null
  advanced: AdvancedSettings
  subModals: Record<SubModalKey, boolean>
  errors: Record<string, string>
  editingId: string | null
  saving: boolean
  loading: boolean
  testing: boolean
  testResult: { success: boolean; message: string } | null
  setActiveTab: (tab: SshConfigTab) => void
  setField: <K extends keyof SshConfigState>(key: K, value: SshConfigState[K]) => void
  setAdvanced: <K extends keyof AdvancedSettings>(key: K, value: AdvancedSettings[K]) => void
  toggleSubModal: (key: SubModalKey, open: boolean) => void
  setError: (key: string, msg: string) => void
  clearError: (key: string) => void
  validate: () => boolean
  reset: () => void
  addTunnel: (tunnel: TunnelEntry) => void
  updateTunnel: (id: string, tunnel: Partial<TunnelEntry>) => void
  removeTunnel: (id: string) => void
  addEnvVar: () => void
  updateEnvVar: (index: number, entry: Partial<EnvEntry>) => void
  removeEnvVar: (index: number) => void
  save: () => Promise<void>
  loadFromConnection: (id: string) => Promise<void>
  testConnection: () => Promise<void>
  prefillFromQuickConnect: (data: { host: string; port: string; user: string; password: string; authType: 'password' | 'key' }) => void
}
