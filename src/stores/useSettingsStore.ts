import { create } from 'zustand'
import * as api from '../api/client'

export interface SettingsState {
  // 通用
  language: string
  theme: 'auto' | 'light' | 'dark'
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

  // 终端
  termFontFamily: string
  termFontSize: number
  termLineHeight: number
  termLetterSpacing: number
  termStripeEnabled: boolean
  termZoomEnabled: boolean

  // 编辑器
  editorFontFamily: string
  editorFontSize: number

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
  theme: 'auto',
  restoreSession: false,
  checkUpdate: true,
  autoSaveLog: false,

  proxyMode: 'none',
  proxyAddress: '',
  proxyPort: '',
  proxyUsername: '',
  proxyPassword: '',

  connectionTimeout: 30,
  heartbeatInterval: 60,
  defaultEncoding: 'utf-8',
  defaultPort: 22,
  autoReconnect: true,
  reconnectCount: 3,
  reconnectInterval: 5,

  defaultAuthMethod: 'password',
  sshCompression: false,
  agentForwarding: false,
  x11Forwarding: false,
  keyExchangeAlgorithm: 'auto',

  downloadDir: '',
  overwritePolicy: 'ask',
  maxConcurrentTransfers: 3,
  notifyOnComplete: true,

  rememberPassword: true,
  masterPassword: false,
  idleLockMinutes: 0,
  clearClipboardOnExit: false,

  dataStoragePath: '',
  logRetentionDays: 30,
  cloudSync: false,

  // 终端
  termFontFamily: 'JetBrainsMono',
  termFontSize: 14,
  termLineHeight: 1.6,
  termLetterSpacing: 0,
  termStripeEnabled: false,
  termZoomEnabled: true,

  // 编辑器
  editorFontFamily: 'JetBrainsMono',
  editorFontSize: 14,

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
  _loaded: boolean
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void
  loadSettings: () => Promise<void>
  applySettings: () => Promise<void>
  resetToDefaults: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  _dirty: false,
  _loaded: false,

  updateSetting: (key, value) => set({ [key]: value, _dirty: true }),

  loadSettings: async () => {
    try {
      const remote = await api.getSettings()
      // 合并远程设置到 store（仅覆盖已有键）
      const merged: Partial<SettingsState> = {}
      for (const [k, v] of Object.entries(remote)) {
        if (k in DEFAULTS) {
          (merged as Record<string, unknown>)[k] = v
        }
      }
      set({ ...merged, _loaded: true, _dirty: false })
    } catch {
      // API 不可用时使用默认值
      set({ _loaded: true })
    }
  },

  applySettings: async () => {
    const state = get()
    // 收集所有 SettingsState 字段
    const settings: Record<string, unknown> = {}
    for (const k of Object.keys(DEFAULTS)) {
      settings[k] = state[k as keyof SettingsState]
    }
    try {
      await api.saveSettings(settings)
      set({ _dirty: false })
    } catch (e) {
      console.error('[Vortix] 保存设置失败', e)
    }
  },

  resetToDefaults: async () => {
    try {
      await api.resetSettings()
    } catch {
      // 忽略 API 错误
    }
    set({ ...DEFAULTS, _dirty: false })
  },
}))
