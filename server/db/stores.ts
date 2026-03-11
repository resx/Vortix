/* ── JSON 存储实例（替代 SQLite 单例） ── */

import path from 'path'
import { fileURLToPath } from 'url'
import { JsonStore, SettingsJsonStore } from './json-store.js'
import { JsonlStore } from './jsonl-store.js'
import type { Folder, ConnectionRow, Shortcut, SshKeyRow, CommandHistory, ConnectionLog, Preset } from '../types/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '../../data')
const CONFIG_DIR = path.join(DATA_DIR, 'config')
const LOGS_DIR = path.join(DATA_DIR, 'logs')

// ── 配置数据存储 ──
export const folderStore = new JsonStore<Folder>(path.join(CONFIG_DIR, 'folders.json'))
export const connectionStore = new JsonStore<ConnectionRow>(path.join(CONFIG_DIR, 'connections.json'))
export const settingsStore = new SettingsJsonStore(path.join(CONFIG_DIR, 'settings.json'))
export const shortcutStore = new JsonStore<Shortcut>(path.join(CONFIG_DIR, 'shortcuts.json'))
export const sshKeyStore = new JsonStore<SshKeyRow>(path.join(CONFIG_DIR, 'ssh-keys.json'))
export const presetStore = new JsonStore<Preset>(path.join(CONFIG_DIR, 'presets.json'))

// ── 运行时日志存储 ──
export const historyStore = new JsonlStore<CommandHistory>(path.join(LOGS_DIR, 'command-history.jsonl'))
export const logStore = new JsonlStore<ConnectionLog>(path.join(LOGS_DIR, 'connection-logs.jsonl'))

/** 初始化所有存储（启动时调用） */
export function initStores(): void {
  folderStore.load()
  connectionStore.load()
  settingsStore.load()
  shortcutStore.load()
  sshKeyStore.load()
  presetStore.load()
  historyStore.load()
  logStore.load()

  // 启动时清理旧日志
  const h = historyStore.cleanup()
  const l = logStore.cleanup()
  if (h + l > 0) console.log(`[Vortix] 清理旧日志: ${h} 条历史, ${l} 条日志`)
}
