/* ── 设置 Repository ── */

import { settingsStore } from '../db/stores.js'

/** 获取所有设置 */
export function getAll(): Record<string, unknown> {
  return settingsStore.getAll()
}

/** 获取单个设置 */
export function get(key: string): unknown | undefined {
  return settingsStore.get(key)
}

/** 批量设置（upsert） */
export function setMany(settings: Record<string, unknown>): void {
  settingsStore.setMany(settings)
}

/** 重置所有设置 */
export function resetAll(): void {
  settingsStore.clear()
}
