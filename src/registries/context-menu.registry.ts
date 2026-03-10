import type { ReactNode } from 'react'

// ── 类型定义 ──

export interface MenuContext {
  type: string
  data: unknown
  close: () => void
}

export interface MenuProvider {
  /** 支持的菜单类型 */
  types: string[]
  /** 渲染菜单内容（直接返回 JSX） */
  render: (ctx: MenuContext) => ReactNode
  /** 菜单最小宽度 class */
  minWidth?: string
}

// ── 注册表 ──

const providers = new Map<string, MenuProvider>()

export function registerMenu(provider: MenuProvider): () => void {
  for (const type of provider.types) {
    providers.set(type, provider)
  }
  return () => {
    for (const type of provider.types) {
      if (providers.get(type) === provider) providers.delete(type)
    }
  }
}

export function getMenuProvider(type: string): MenuProvider | undefined {
  return providers.get(type)
}
