import { create } from 'zustand'

export interface SettingsState {
  // 通用
  language: string
  restoreSession: boolean
  checkUpdate: boolean
  autoSaveLog: boolean

  // 网络
  proxyMode: string
  proxyAddress: string
  proxyPort: string
  proxyUsername: string
  proxyPassword: string

  // 连接
  connectionTimeout: number
  heartbeatInterval: number
  defaultEncoding: string
  defaultPort: number
  autoReconnect: boolean
  reconnectCount: number
  reconnectInterval: number

  // SSH
  defaultAuthMethod: string
  sshCompression: boolean
  agentForwarding: boolean
  x11Forwarding: boolean
  keyExchangeAlgorithm: string

  // 文件传输
  downloadDir: string
  overwritePolicy: string
  maxConcurrentTransfers: number
  notifyOnComplete: boolean

  // 安全
  rememberPassword: boolean
  masterPassword: boolean
  idleLockMinutes: number
  clearClipboardOnExit: boolean

  // 数据
  dataStoragePath: string
  logRetentionDays: number
  cloudSync: boolean

  // 数据库
  dbTableFont: string
  dbAutoExpand: boolean
  dbShowPrimaryKey: boolean
  dbCalcTotalRows: boolean
  dbCompositeHeader: boolean
  dbLoadAllFields: boolean
  dbTextAlign: string
  dbRowsPerPage: number
  dbDangerSqlConfirm: boolean
  dbSqlStopOnError: boolean
  dbScrollMode: string
  dbCursorScrollSpeed: number

  // Redis
  redisMaxLoadCount: number
  redisGroupSeparator: string
  redisShowValue: boolean
}

const DEFAULTS: SettingsState = {
  language: 'zh-CN',
  restoreSession: false,
  checkUpdate: true,
  autoSaveLog: false,

  proxyMode: 'auto',
  proxyAddress: '100',
  proxyPort: '14',
  proxyUsername: '',
  proxyPassword: '',

  connectionTimeout: 30,
  heartbeatInterval: 60,
  defaultEncoding: 'JetBrainsMono',
  defaultPort: 22,
  autoReconnect: true,
  reconnectCount: 3,
  reconnectInterval: 5,

  defaultAuthMethod: 'MonoLisa',
  sshCompression: false,
  agentForwarding: false,
  x11Forwarding: false,
  keyExchangeAlgorithm: 'crlf',

  downloadDir: 'tab',
  overwritePolicy: 'stable',
  maxConcurrentTransfers: 3,
  notifyOnComplete: true,

  rememberPassword: true,
  masterPassword: false,
  idleLockMinutes: 0,
  clearClipboardOnExit: false,

  dataStoragePath: '',
  logRetentionDays: 30,
  cloudSync: false,

  // 数据库
  dbTableFont: 'JetBrainsMono',
  dbAutoExpand: true,
  dbShowPrimaryKey: true,
  dbCalcTotalRows: false,
  dbCompositeHeader: false,
  dbLoadAllFields: false,
  dbTextAlign: 'auto',
  dbRowsPerPage: 500,
  dbDangerSqlConfirm: true,
  dbSqlStopOnError: false,
  dbScrollMode: 'natural',
  dbCursorScrollSpeed: 1,

  // Redis
  redisMaxLoadCount: 10000,
  redisGroupSeparator: ':',
  redisShowValue: false,
}

interface SettingsStore extends SettingsState {
  _dirty: boolean
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void
  applySettings: () => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...DEFAULTS,
  _dirty: false,

  updateSetting: (key, value) => set({ [key]: value, _dirty: true }),
  applySettings: () => set({ _dirty: false }),
  resetToDefaults: () => set({ ...DEFAULTS, _dirty: false }),
}))
