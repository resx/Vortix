import type { TerminalHighlightRule } from '../../lib/terminal-highlight/rules'
import type { SuggestionMatchMode, SuggestionSource } from '../../lib/terminal-suggestions'

export interface SettingsState {
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
  connectionTimeout: number
  heartbeatInterval: number
  defaultEncoding: string
  defaultPort: number
  autoReconnect: boolean
  reconnectCount: number
  reconnectInterval: number
  termThemeLight: string
  termThemeDark: string
  termCursorStyle: 'block' | 'underline' | 'bar'
  termCursorBlink: boolean
  termFontFamily: string[]
  termFontSize: number
  termLineHeight: number
  termLetterSpacing: number
  termZoomEnabled: boolean
  termStripeEnabled: boolean
  termHighlightRules: TerminalHighlightRule[]
  activeProfileId: string
  termHighlightEnhance: boolean
  sshSftpPathSync: boolean
  termSelectAutoCopy: boolean
  termCommandHint: boolean
  termSuggestionMode: SuggestionMatchMode | 'off'
  termSuggestionSources: SuggestionSource[]
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
  sftpDefaultEditor: string
  sftpParentDirClick: boolean
  sftpFileListLayout: string
  sftpListTimeout: number
  sftpDefaultSavePath: string
  sftpDoubleClickAction: string
  sftpShowHidden: boolean
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
  redisMaxLoadCount: number
  redisGroupSeparator: string
  redisShowValue: boolean
  hideEmptyFolders: boolean
  syncRepoSource: 'local' | 'git' | 'webdav' | 's3'
  syncAutoSync: boolean
  syncCheckInterval: number
  syncEncryptionKey: string
  syncTlsVerify: boolean
  syncLocalPath: string
  syncGitUrl: string
  syncGitBranch: string
  syncGitPath: string
  syncGitUsername: string
  syncGitPassword: string
  syncGitSshKey: string
  syncGitSshKeyLabel: string
  syncGitSshKeyMode: 'manager' | 'manual'
  syncWebdavEndpoint: string
  syncWebdavPath: string
  syncWebdavUsername: string
  syncWebdavPassword: string
  syncS3Style: string
  syncS3Endpoint: string
  syncS3Path: string
  syncS3Region: string
  syncS3Bucket: string
  syncS3AccessKey: string
  syncS3SecretKey: string
  debugMode: boolean
}

export interface SettingsStore extends SettingsState {
  _dirty: boolean
  _loaded: boolean
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void
  loadSettings: () => Promise<void>
  applySettings: () => Promise<void>
  resetToDefaults: () => Promise<void>
}
