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
}

interface SettingsStore extends SettingsState {
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  // 通用
  language: 'zh-CN',
  restoreSession: false,
  checkUpdate: true,
  autoSaveLog: false,

  // 网络
  proxyMode: 'none',
  proxyAddress: '',
  proxyPort: '',
  proxyUsername: '',
  proxyPassword: '',

  // 连接
  connectionTimeout: 30,
  heartbeatInterval: 60,
  defaultEncoding: 'UTF-8',
  defaultPort: 22,
  autoReconnect: true,
  reconnectCount: 3,
  reconnectInterval: 5,

  // SSH
  defaultAuthMethod: 'password',
  sshCompression: false,
  agentForwarding: false,
  x11Forwarding: false,
  keyExchangeAlgorithm: 'auto',

  // 文件传输
  downloadDir: '~/Downloads',
  overwritePolicy: 'ask',
  maxConcurrentTransfers: 3,
  notifyOnComplete: true,

  // 安全
  rememberPassword: true,
  masterPassword: false,
  idleLockMinutes: 0,
  clearClipboardOnExit: false,

  // 数据
  dataStoragePath: '',
  logRetentionDays: 30,
  cloudSync: false,

  updateSetting: (key, value) => set({ [key]: value }),
}))
