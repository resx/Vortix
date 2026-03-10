/* ── 设置面板注册表 ── */

import type { ComponentType } from 'react'

export interface SettingsNavItem {
  type: 'item'
  id: string
  label: string
  component?: ComponentType
}

export interface SettingsNavGroup {
  type: 'group'
  label: string
  mt?: boolean
}

export type SettingsEntry = SettingsNavItem | SettingsNavGroup

const entries: SettingsEntry[] = []

/** 注册设置面板导航项（按调用顺序排列） */
export function registerSettingsPanels(items: SettingsEntry[]): () => void {
  entries.push(...items)
  return () => {
    for (const item of items) {
      const idx = entries.indexOf(item)
      if (idx >= 0) entries.splice(idx, 1)
    }
  }
}

/** 获取所有已注册的设置面板导航项 */
export function getSettingsEntries(): readonly SettingsEntry[] {
  return entries
}

/** 根据 id 查找对应的组件 */
export function getSettingsComponent(id: string): ComponentType | undefined {
  const item = entries.find((e): e is SettingsNavItem => e.type === 'item' && e.id === id)
  return item?.component
}
