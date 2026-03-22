/* ── 分屏工作区类型定义 ── */

export type SplitDirection = 'horizontal' | 'vertical'

/** 拖拽放置象限 */
export type DropZone = 'left' | 'right' | 'top' | 'bottom' | 'center'

/** 面板元数据（跨标签页转移时保留原始标签页信息） */
export interface PaneMeta {
  label: string
  connectionId?: string
  assetRow?: import('./index').AssetRow
  quickConnect?: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
    passphrase?: string
    terminalEnhance?: boolean
  }
  connectedAt?: string
}

/** 叶子节点：单个终端面板 */
export interface PaneLeaf {
  type: 'leaf'
  id: string
  flexGrow: number
  collapsed: boolean
  /** 跨标签页转移时保留的原始元数据 */
  meta?: PaneMeta
}

/** 分支节点：包含子节点的分割容器 */
export interface SplitBranch {
  type: 'split'
  id: string
  direction: SplitDirection
  children: SplitNode[]
  flexGrow: number
}

export type SplitNode = PaneLeaf | SplitBranch

/** 每个标签页的工作区状态 */
export interface TabWorkspace {
  rootNode: SplitNode
  activePaneId: string | null
}
