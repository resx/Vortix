import { create } from "zustand";
import * as api from "../api/client";
import { getThemeById } from "../components/terminal/themes/index";
import { loadLocale } from "../i18n";
import type { TerminalHighlightRule } from "../lib/terminal-highlight/rules";

export type {
  BuiltinTerminalHighlightRule,
  CustomTerminalHighlightRule,
  TerminalHighlightRule,
  TerminalHighlightSemanticToken,
} from "../lib/terminal-highlight/rules";
export {
  DEFAULT_TERMINAL_HIGHLIGHT_RULES,
  normalizeTerminalHighlightRules,
} from "../lib/terminal-highlight/rules";
import {
  DEFAULT_TERMINAL_HIGHLIGHT_RULES,
  normalizeTerminalHighlightRules,
} from "../lib/terminal-highlight/rules";

export const SYNC_VERIFIED_SIGNATURE_HASH_KEY = 'vortix.sync.verifiedSignatureHash.v1'

export function hashSyncSignature(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}


export interface SettingsState {
  // ── 基础设置 ──
  language: string;
  theme: "auto" | "light" | "dark";
  uiFontFamily: string[];
  uiZoom: number;
  middleClickCloseTab: boolean;
  editorLineEnding: string;
  enableAnimation: boolean;
  showRealtimeInfo: boolean;
  tabCloseButtonLeft: boolean;
  fontLigatures: boolean;
  tabCloseConfirm: boolean;
  tabFlashNotify: boolean;
  tabMultiLine: boolean;
  updateChannel: string;
  editorFontFamily: string[];
  editorFontSize: number;
  editorWordWrap: boolean;
  editorTabMode: string;
  lockOnStart: boolean;
  lockPassword: string;
  idleLockMinutes: number;
  restoreSession: boolean;

  // ── 连接 ──
  connectionTimeout: number;
  heartbeatInterval: number;
  defaultEncoding: string;
  defaultPort: number;
  autoReconnect: boolean;
  reconnectCount: number;
  reconnectInterval: number;

  // ── 终端 ──
  termThemeLight: string;
  termThemeDark: string;
  termCursorStyle: "block" | "underline" | "bar";
  termCursorBlink: boolean;
  termFontFamily: string[];
  termFontSize: number;
  termLineHeight: number;
  termLetterSpacing: number;
  termZoomEnabled: boolean;
  termStripeEnabled: boolean;
  termHighlightRules: TerminalHighlightRule[];
  activeProfileId: string;

  // ── SSH 设置 ──
  termHighlightEnhance: boolean;
  sshSftpPathSync: boolean;
  termSelectAutoCopy: boolean;
  termCommandHint: boolean;
  sshHistoryEnabled: boolean;
  sshHistoryStorage: string;
  sshHistoryLoadCount: number;
  termHighPerformance: boolean;
  termMiddleClickAction: string;
  termRightClickAction: string;
  termSound: boolean;
  termCtrlVPaste: boolean;
  termScrollback: number;
  termLogDir: string;

  // ── SFTP 设置 ──
  sftpDefaultEditor: string;
  sftpParentDirClick: boolean;
  sftpFileListLayout: string;
  sftpRemoteColumns: string[];
  sftpListTimeout: number;
  sftpDefaultSavePath: string;
  sftpDoubleClickAction: string;
  sftpShowHidden: boolean;
  sftpLocalColumns: string[];

  // ── 数据库 ──
  dbTableFont: string[];
  dbAutoExpand: boolean;
  dbShowPrimaryKey: boolean;
  dbCalcTotalRows: boolean;
  dbCompositeHeader: boolean;
  dbLoadAllFields: boolean;
  dbTextAlign: string;
  dbRowsPerPage: number;
  dbDangerSqlConfirm: boolean;
  dbSqlStopOnError: boolean;
  dbScrollMode: string;
  dbCursorScrollSpeed: number;

  // ── Redis ──
  redisMaxLoadCount: number;
  redisGroupSeparator: string;
  redisShowValue: boolean;

  // ── 侧边栏 ──
  hideEmptyFolders: boolean;

  // ── 云同步 ──
  syncRepoSource: 'local' | 'git' | 'webdav' | 's3';
  syncAutoSync: boolean;
  syncCheckInterval: number; // 远端变更检测间隔（分钟），默认 15
  syncEncryptionKey: string;
  syncTlsVerify: boolean;
  // 本地文件
  syncLocalPath: string;
  // Git
  syncGitUrl: string;
  syncGitBranch: string;
  syncGitPath: string;
  syncGitUsername: string;
  syncGitPassword: string;
  syncGitSshKey: string;
  syncGitSshKeyLabel: string;
  syncGitSshKeyMode: 'manager' | 'manual';
  // WebDAV
  syncWebdavEndpoint: string;
  syncWebdavPath: string;
  syncWebdavUsername: string;
  syncWebdavPassword: string;
  // S3
  syncS3Style: string;
  syncS3Endpoint: string;
  syncS3Path: string;
  syncS3Region: string;
  syncS3Bucket: string;
  syncS3AccessKey: string;
  syncS3SecretKey: string;

  // ── 调试 ──
  debugMode: boolean;
}

const DEFAULTS: SettingsState = {
  // ── 基础设置 ──
  language: "zh-CN",
  theme: "auto",
  uiFontFamily: ["system"],
  uiZoom: 100,
  middleClickCloseTab: false,
  editorLineEnding: "lf",
  enableAnimation: true,
  showRealtimeInfo: true,
  tabCloseButtonLeft: true,
  fontLigatures: false,
  tabCloseConfirm: true,
  tabFlashNotify: true,
  tabMultiLine: false,
  updateChannel: "stable",
  editorFontFamily: ["JetBrainsMono"],
  editorFontSize: 14,
  editorWordWrap: true,
  editorTabMode: "four-spaces",
  lockOnStart: false,
  lockPassword: "",
  idleLockMinutes: 0,
  restoreSession: false,

  // ── 连接 ──
  connectionTimeout: 30,
  heartbeatInterval: 60,
  defaultEncoding: "utf-8",
  defaultPort: 22,
  autoReconnect: true,
  reconnectCount: 3,
  reconnectInterval: 5,

  // ── 终端 ──
  termThemeLight: "default-light",
  termThemeDark: "default-dark",
  termCursorStyle: "bar",
  termCursorBlink: true,
  termFontFamily: ["JetBrainsMono"],
  termFontSize: 14,
  termLineHeight: 1,
  termLetterSpacing: 0,
  termZoomEnabled: true,
  termStripeEnabled: false,
  termHighlightRules: DEFAULT_TERMINAL_HIGHLIGHT_RULES.map((rule) => ({ ...rule })),
  activeProfileId: "__default__",

  // ── SSH 设置 ──
  termHighlightEnhance: true,
  sshSftpPathSync: true,
  termSelectAutoCopy: false,
  termCommandHint: true,
  sshHistoryEnabled: true,
  sshHistoryStorage: "local",
  sshHistoryLoadCount: 100,
  termHighPerformance: true,
  termMiddleClickAction: "none",
  termRightClickAction: "menu",
  termSound: false,
  termCtrlVPaste: true,
  termScrollback: 1000,
  termLogDir: "",

  // ── SFTP 设置 ──
  sftpDefaultEditor: "builtin",
  sftpParentDirClick: false,
  sftpFileListLayout: "horizontal",
  sftpRemoteColumns: ["name", "mtime", "type", "size"],
  sftpListTimeout: 60,
  sftpDefaultSavePath: "",
  sftpDoubleClickAction: "auto",
  sftpShowHidden: false,
  sftpLocalColumns: ["name", "mtime", "type", "size"],

  // ── 数据库 ──
  dbTableFont: ["JetBrainsMono"],
  dbAutoExpand: true,
  dbShowPrimaryKey: true,
  dbCalcTotalRows: false,
  dbCompositeHeader: false,
  dbLoadAllFields: false,
  dbTextAlign: "auto",
  dbRowsPerPage: 500,
  dbDangerSqlConfirm: true,
  dbSqlStopOnError: false,
  dbScrollMode: "natural",
  dbCursorScrollSpeed: 1,

  // ── Redis ──
  redisMaxLoadCount: 10000,
  redisGroupSeparator: ":",
  redisShowValue: false,

  // ── 侧边栏 ──
  hideEmptyFolders: false,

  // ── 云同步 ──
  syncRepoSource: "local",
  syncAutoSync: false,
  syncCheckInterval: 15,
  syncEncryptionKey: "",
  syncTlsVerify: true,
  // 本地文件
  syncLocalPath: "",
  // Git
  syncGitUrl: "",
  syncGitBranch: "",
  syncGitPath: "",
  syncGitUsername: "",
  syncGitPassword: "",
  syncGitSshKey: "",
  syncGitSshKeyLabel: "",
  syncGitSshKeyMode: "manager",
  // WebDAV
  syncWebdavEndpoint: "",
  syncWebdavPath: "vortix",
  syncWebdavUsername: "",
  syncWebdavPassword: "",
  // S3
  syncS3Style: "virtual-hosted",
  syncS3Endpoint: "https://s3.amazonaws.com",
  syncS3Path: "vortix",
  syncS3Region: "ap-east-1",
  syncS3Bucket: "",
  syncS3AccessKey: "",
  syncS3SecretKey: "",

  // ── 调试 ──
  debugMode: false,
};

export function buildSyncVerificationSignature(s: SettingsState): string {
  if (s.syncRepoSource === 'local') return `local|${s.syncLocalPath}`
  if (s.syncRepoSource === 'git') {
    const gitUrl = (s.syncGitUrl ?? '').trim().toLowerCase()
    const isSsh = gitUrl.startsWith('git@') || gitUrl.startsWith('ssh://')
    if (isSsh) {
      return `git|ssh|${s.syncGitUrl}|${s.syncGitBranch}|${s.syncGitPath}|${s.syncGitSshKey}|${s.syncGitSshKeyLabel}|${s.syncGitSshKeyMode}`
    }
    return `git|https|${s.syncGitUrl}|${s.syncGitBranch}|${s.syncGitPath}|${s.syncGitUsername}|${s.syncGitPassword}`
  }
  if (s.syncRepoSource === 'webdav') {
    return `webdav|${s.syncWebdavEndpoint}|${s.syncWebdavPath}|${s.syncWebdavUsername}|${s.syncWebdavPassword}`
  }
  return `s3|${s.syncS3Style}|${s.syncS3Endpoint}|${s.syncS3Path}|${s.syncS3Region}|${s.syncS3Bucket}|${s.syncS3AccessKey}|${s.syncS3SecretKey}`
}

/** 从 settings store 构建同步请求体（共享工具函数） */

export function isSyncConfigured(s: SettingsState): boolean {
  if (s.syncRepoSource === 'local') {
    return !!(s.syncLocalPath ?? '').trim()
  }
  if (s.syncRepoSource === 'git') {
    return !!(s.syncGitUrl ?? '').trim()
  }
  if (s.syncRepoSource === 'webdav') {
    return !!(s.syncWebdavEndpoint ?? '').trim()
  }
  if (s.syncRepoSource === 's3') {
    return !!(s.syncS3Endpoint ?? '').trim()
      && !!(s.syncS3Bucket ?? '').trim()
      && !!(s.syncS3AccessKey ?? '').trim()
      && !!s.syncS3SecretKey
  }
  return false
}

export function buildSyncBody(): import('../api/types').SyncRequestBody {
  const s = useSettingsStore.getState()
  const body: import('../api/types').SyncRequestBody = {
    repoSource: s.syncRepoSource,
    // v5 同步方案为默认且唯一主路径（旧格式仅用于服务端读兼容）
    syncFormatVersion: 5,
    syncUseChunkedManifest: false,
    syncHashAlgorithm: 'sha256',
    syncCompressChunks: true,
  }

  if (s.syncEncryptionKey.trim()) {
    body.encryptionKey = s.syncEncryptionKey
  }

  if (s.syncRepoSource === 'local') {
    body.syncLocalPath = s.syncLocalPath ?? ''
    return body
  }

  if (s.syncRepoSource === 'git') {
    const gitUrl = (s.syncGitUrl ?? '').trim()
    body.syncGitUrl = gitUrl
    if (s.syncGitBranch.trim()) body.syncGitBranch = s.syncGitBranch
    if (s.syncGitPath.trim()) body.syncGitPath = s.syncGitPath

    const lower = gitUrl.toLowerCase()
    const isSsh = lower.startsWith('git@') || lower.startsWith('ssh://')
    if (isSsh) {
      if (s.syncGitSshKey.trim()) body.syncGitSshKey = s.syncGitSshKey
    } else {
      if (s.syncGitUsername.trim()) body.syncGitUsername = s.syncGitUsername
      if (s.syncGitPassword) body.syncGitPassword = s.syncGitPassword
      if (!s.syncTlsVerify) body.syncTlsVerify = false
    }
    return body
  }

  if (s.syncRepoSource === 'webdav') {
    body.syncWebdavEndpoint = (s.syncWebdavEndpoint ?? '').trim()
    if (s.syncWebdavPath.trim()) body.syncWebdavPath = s.syncWebdavPath
    if (s.syncWebdavUsername.trim()) body.syncWebdavUsername = s.syncWebdavUsername
    if (s.syncWebdavPassword) body.syncWebdavPassword = s.syncWebdavPassword
    if (!s.syncTlsVerify) body.syncTlsVerify = false
    return body
  }

  if (s.syncRepoSource === 's3') {
    if (s.syncS3Style.trim()) body.syncS3Style = s.syncS3Style
    body.syncS3Endpoint = (s.syncS3Endpoint ?? '').trim()
    if (s.syncS3Path.trim()) body.syncS3Path = s.syncS3Path
    if (s.syncS3Region.trim()) body.syncS3Region = s.syncS3Region
    if (s.syncS3Bucket.trim()) body.syncS3Bucket = s.syncS3Bucket
    if (s.syncS3AccessKey.trim()) body.syncS3AccessKey = s.syncS3AccessKey
    if (s.syncS3SecretKey) body.syncS3SecretKey = s.syncS3SecretKey
    if (!s.syncTlsVerify) body.syncTlsVerify = false
    return body
  }

  return body
}

interface SettingsStore extends SettingsState {
  _dirty: boolean;
  _loaded: boolean;
  updateSetting: <K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K],
  ) => void;
  loadSettings: () => Promise<void>;
  applySettings: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  _dirty: false,
  _loaded: false,

  updateSetting: (key, value) => {
    set({ [key]: value, _dirty: true });
    if (key === "language") loadLocale(value as string);
  },

  loadSettings: async () => {
    try {
      const remote = await api.getSettings();
      // 合并远程设置到 store（仅覆盖已有键）
      const merged: Partial<SettingsState> = {};
      for (const [k, v] of Object.entries(remote)) {
        if (k in DEFAULTS) {
          (merged as Record<string, unknown>)[k] = v;
        }
      }
      merged.termHighlightRules = normalizeTerminalHighlightRules((remote as Record<string, unknown>).termHighlightRules);

      // 向后兼容：旧字体字段 string → string[]
      const FONT_KEYS = [
        "uiFontFamily",
        "editorFontFamily",
        "termFontFamily",
        "dbTableFont",
      ] as const;
      for (const fk of FONT_KEYS) {
        if (typeof merged[fk] === "string") {
          (merged as Record<string, unknown>)[fk] = [merged[fk]];
        }
      }

      // 向后兼容：旧 termTheme 字段迁移到 termThemeLight / termThemeDark
      const legacy = (remote as Record<string, unknown>).termTheme;
      if (typeof legacy === "string" && !("termThemeLight" in remote)) {
        if (legacy === "auto") {
          merged.termThemeLight = "default-light";
          merged.termThemeDark = "default-dark";
        } else {
          // 根据主题 mode 分配到对应字段
          const preset = getThemeById(legacy);
          if (preset) {
            if (preset.mode === "dark") {
              merged.termThemeDark = legacy;
              merged.termThemeLight = DEFAULTS.termThemeLight;
            } else {
              merged.termThemeLight = legacy;
              merged.termThemeDark = DEFAULTS.termThemeDark;
            }
          }
        }
      }

      set({ ...merged, _loaded: true, _dirty: false });
    } catch {
      // API 不可用时使用默认值
      set({ _loaded: true });
    }
  },

  applySettings: async () => {
    const state = get();
    // 防止 HMR 重建 store 后未加载就保存，覆盖后端数据
    if (!state._loaded) return;
    // 收集所有 SettingsState 字段
    const settings: Record<string, unknown> = {};
    for (const k of Object.keys(DEFAULTS)) {
      settings[k] = state[k as keyof SettingsState];
    }
    try {
      await api.saveSettings(settings);
      set({ _dirty: false });
    } catch (e) {
      console.error("[Vortix] 保存设置失败", e);
    }
  },

  resetToDefaults: async () => {
    // 终端外观设置由 Profile 系统管理，重置时保留
    const TERM_APPEARANCE_KEYS: (keyof SettingsState)[] = [
      "termThemeLight",
      "termThemeDark",
      "termCursorStyle",
      "termCursorBlink",
      "termFontFamily",
      "termFontSize",
      "termLineHeight",
      "termLetterSpacing",
      "termScrollback",
      "termHighlightRules",
      "activeProfileId",
    ];
    const preserved: Partial<SettingsState> = {};
    const current = get();
    for (const k of TERM_APPEARANCE_KEYS) {
      (preserved as Record<string, unknown>)[k] = current[k];
    }
    try {
      await api.resetSettings();
    } catch {
      // 忽略 API 错误
    }
    set({ ...DEFAULTS, ...preserved, _dirty: false });
  },
}));
