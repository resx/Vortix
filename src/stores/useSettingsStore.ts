import { create } from 'zustand'
import * as api from '../api/client'
import { getThemeById } from '../components/terminal/themes/index'

export interface SettingsState {
  // ── 基础设置 ──
  language: string
  theme: 'auto' | 'light' | 'dark'
  uiFontFamily: string[]
  uiZoom: number
  middleClickCloseTab: boolean
  editorLineEnding: string
  enableAnimation: boolean
  showRealtimeInfo: boolean
  tabCloseButtonLeft: boolean
  fontLigatures: boolean
  tabCloseConfirm: boolean
  tabFlashNotify: boolean
  tabMultiLine: boolean
  updateChannel: string
  editorFontFamily: string[]
  editorFontSize: number
  editorWordWrap: boolean
  editorTabMode: string
  lockOnStart: boolean
  lockPassword: string
  idleLockMinutes: number
  restoreSession: boolean
  showMemberBadge: boolean

  // ── 连接 ──
  connectionTimeout: number
  heartbeatInterval: number
  defaultEncoding: string
  defaultPort: number
  autoReconnect: boolean
  reconnectCount: number
  reconnectInterval: number

  // ── 终端 ──
  termThemeLight: string
  termThemeDark: string
  termCursorStyle: 'block' | 'underline' | 'bar'
  termCursorBlink: boolean
  termFontFamily: string[]
  termFontSize: number
  termLineHeight: number
  termLetterSpacing: number
  termZoomEnabled: boolean
  keywordHighlights: {
    error: string
    warning: string
    ok: string
    info: string
    debug: string
    ipMac: string
  }
  activeProfileId: string

  // ── SSH 设置 ──
  termHighlightEnhance: boolean
  sshSftpPathSync: boolean
  termSelectAutoCopy: boolean
  termCommandHint: boolean
  sshHistoryEnabled: boolean
  sshHistoryStorage: string
  sshHistoryLoadCount: number
  termHighPerformance: boolean
  termMiddleClickAction: string
  termRightClickAction: string
  termSound: boolean
  termCtrlVPaste: boolean
  termScrollback: number
  termLogDir: string

  // ── SFTP 设置 ──
  sftpDefaultEditor: string
  sftpParentDirClick: boolean
  sftpFileListLayout: string
  sftpRemoteColumns: string[]
  sftpListTimeout: number
  sftpDefaultSavePath: string
  sftpDoubleClickAction: string
  sftpShowHidden: boolean
  sftpLocalColumns: string[]

  // ── 数据库 ──
  dbTableFont: string[]
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

  // ── Redis ──
  redisMaxLoadCount: number
  redisGroupSeparator: string
  redisShowValue: boolean
}

const DEFAULTS: SettingsState = {
  // ── 基础设置 ──
  language: 'zh-CN',
  theme: 'auto',
  uiFontFamily: ['system'],
  uiZoom: 100,
  middleClickCloseTab: false,
  editorLineEnding: 'lf',
  enableAnimation: true,
  showRealtimeInfo: true,
  tabCloseButtonLeft: false,
  fontLigatures: false,
  tabCloseConfirm: true,
  tabFlashNotify: true,
  tabMultiLine: false,
  updateChannel: 'stable',
  editorFontFamily: ['JetBrainsMono'],
  editorFontSize: 14,
  editorWordWrap: true,
  editorTabMode: 'four-spaces',
  lockOnStart: false,
  lockPassword: '',
  idleLockMinutes: 0,
  restoreSession: false,
  showMemberBadge: true,

  // ── 连接 ──
  connectionTimeout: 30,
  heartbeatInterval: 60,
  defaultEncoding: 'utf-8',
  defaultPort: 22,
  autoReconnect: true,
  reconnectCount: 3,
  reconnectInterval: 5,

  // ── 终端 ──
  termThemeLight: 'default-light',
  termThemeDark: 'default-dark',
  termCursorStyle: 'bar',
  termCursorBlink: true,
  termFontFamily: ['JetBrainsMono'],
  termFontSize: 14,
  termLineHeight: 1.6,
  termLetterSpacing: 0,
  termZoomEnabled: true,
  keywordHighlights: {
    error: '#F53F3F',
    warning: '#E6A23C',
    ok: '#00B42A',
    info: '#4080FF',
    debug: '#86909C',
    ipMac: '#9A7ECC',
  },
  activeProfileId: '__default__',

  // ── SSH 设置 ──
  termHighlightEnhance: false,
  sshSftpPathSync: true,
  termSelectAutoCopy: false,
  termCommandHint: true,
  sshHistoryEnabled: true,
  sshHistoryStorage: 'local',
  sshHistoryLoadCount: 100,
  termHighPerformance: false,
  termMiddleClickAction: 'none',
  termRightClickAction: 'menu',
  termSound: false,
  termCtrlVPaste: true,
  termScrollback: 1000,
  termLogDir: '',

  // ── SFTP 设置 ──
  sftpDefaultEditor: 'builtin',
  sftpParentDirClick: false,
  sftpFileListLayout: 'horizontal',
  sftpRemoteColumns: ['name', 'mtime', 'type', 'size'],
  sftpListTimeout: 60,
  sftpDefaultSavePath: '',
  sftpDoubleClickAction: 'auto',
  sftpShowHidden: false,
  sftpLocalColumns: ['name', 'mtime', 'type', 'size'],

  // ── 数据库 ──
  dbTableFont: ['JetBrainsMono'],
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

  // ── Redis ──
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

      // 向后兼容：旧字体字段 string → string[]
      const FONT_KEYS = ['uiFontFamily', 'editorFontFamily', 'termFontFamily', 'dbTableFont'] as const
      for (const fk of FONT_KEYS) {
        if (typeof merged[fk] === 'string') {
          ;(merged as Record<string, unknown>)[fk] = [merged[fk]]
        }
      }

      // 向后兼容：旧 termTheme 字段迁移到 termThemeLight / termThemeDark
      const legacy = (remote as Record<string, unknown>).termTheme
      if (typeof legacy === 'string' && !('termThemeLight' in remote)) {
        if (legacy === 'auto') {
          merged.termThemeLight = 'default-light'
          merged.termThemeDark = 'default-dark'
        } else {
          // 根据主题 mode 分配到对应字段
          const preset = getThemeById(legacy)
          if (preset) {
            if (preset.mode === 'dark') {
              merged.termThemeDark = legacy
              merged.termThemeLight = DEFAULTS.termThemeLight
            } else {
              merged.termThemeLight = legacy
              merged.termThemeDark = DEFAULTS.termThemeDark
            }
          }
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
