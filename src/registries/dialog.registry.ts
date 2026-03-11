/* ── 对话框注册表 ── */

import type { ComponentType } from 'react'

export interface DialogRegistration {
  id: string
  component: ComponentType
  /** 返回该对话框是否应该显示的 selector */
  isOpen: () => boolean
}

const dialogs: DialogRegistration[] = []

/** 注册对话框（同 id 去重，HMR 安全） */
export function registerDialog(reg: DialogRegistration): () => void {
  const existing = dialogs.findIndex(d => d.id === reg.id)
  if (existing >= 0) {
    dialogs[existing] = reg
  } else {
    dialogs.push(reg)
  }
  return () => {
    const idx = dialogs.indexOf(reg)
    if (idx >= 0) dialogs.splice(idx, 1)
  }
}

/** 获取所有已注册的对话框 */
export function getDialogs(): readonly DialogRegistration[] {
  return dialogs
}
