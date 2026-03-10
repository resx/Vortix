import type { ReactNode } from 'react'

// ── 类型定义 ──

export interface ConnectionTypeDef {
  protocol: string
  label: string
  icon?: string
  /** 使用 ProtocolIcon 而非 AppIcon */
  useProtocolIcon?: boolean
  /** 是否已实现 */
  implemented: boolean
  /** 打开配置对话框 */
  openConfig?: (mode: 'create' | 'edit', id?: string) => void
}

// ── 注册表 ──

const types: ConnectionTypeDef[] = []

export function registerConnectionType(def: ConnectionTypeDef): () => void {
  types.push(def)
  return () => {
    const idx = types.indexOf(def)
    if (idx >= 0) types.splice(idx, 1)
  }
}

export function getConnectionTypes(): readonly ConnectionTypeDef[] {
  return types
}

export function getConnectionType(protocol: string): ConnectionTypeDef | undefined {
  return types.find(t => t.protocol === protocol)
}
