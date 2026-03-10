/* ── 同步状态管理（data/sync-state.json） ── */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import type { SyncState } from '../types/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE_PATH = path.resolve(__dirname, '../../data/sync-state.json')

/** 生成 8 位 hex 设备指纹 */
function generateDeviceId(): string {
  return crypto.randomBytes(4).toString('hex')
}

/** 读取本地同步状态 */
export function getSyncState(): SyncState {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
    }
  } catch { /* 文件损坏则重建 */ }
  const state: SyncState = {
    deviceId: generateDeviceId(),
    lastSyncRevision: 0,
    lastSyncAt: null,
    localDirty: false,
  }
  saveSyncState(state)
  return state
}

/** 写入本地同步状态（原子写入） */
export function saveSyncState(state: SyncState): void {
  const dir = path.dirname(STATE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = STATE_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
  fs.renameSync(tmp, STATE_PATH)
}

/** 标记本地数据已变更 */
export function markDirty(): void {
  const state = getSyncState()
  if (!state.localDirty) {
    state.localDirty = true
    saveSyncState(state)
  }
}

/** 同步成功后更新状态 */
export function onSyncSuccess(revision: number): void {
  const state = getSyncState()
  state.lastSyncRevision = revision
  state.lastSyncAt = new Date().toISOString()
  state.localDirty = false
  saveSyncState(state)
}
