/* ── 分屏工作区状态管理 ── */

import { create } from 'zustand'
import type { SplitNode, PaneLeaf, SplitBranch, TabWorkspace, SplitDirection, DropZone, PaneMeta } from '../types/workspace'

/* ── 纯函数工具 ── */

let paneCounter = 0
export function nextPaneId() {
  return `pane-${++paneCounter}`
}

let splitCounter = 0
function nextSplitId() {
  return `split-${++splitCounter}`
}

function createLeaf(id?: string): PaneLeaf {
  return { type: 'leaf', id: id ?? nextPaneId(), flexGrow: 1, collapsed: false }
}

/** 收集所有叶子节点 ID */
export function collectLeafIds(node: SplitNode): string[] {
  if (node.type === 'leaf') return [node.id]
  return node.children.flatMap(collectLeafIds)
}

/** 在树中替换指定 ID 的节点 */
function replaceNode(root: SplitNode, targetId: string, replacement: SplitNode): SplitNode {
  if (root.id === targetId) return replacement
  if (root.type === 'leaf') return root
  return {
    ...root,
    children: root.children.map(c => replaceNode(c, targetId, replacement)),
  }
}

/** 从树中移除叶子节点，自动解包单子节点容器 */
function removeLeaf(root: SplitNode, leafId: string): SplitNode | null {
  if (root.type === 'leaf') {
    return root.id === leafId ? null : root
  }
  const remaining = root.children
    .map(c => removeLeaf(c, leafId))
    .filter((c): c is SplitNode => c !== null)

  if (remaining.length === 0) return null
  if (remaining.length === 1) {
    // 解包：继承父级 flexGrow
    const child = remaining[0]
    return { ...child, flexGrow: root.flexGrow }
  }
  return { ...root, children: remaining }
}

/** 从树中查找指定节点 */
export function findNode(root: SplitNode, id: string): SplitNode | null {
  if (root.id === id) return root
  if (root.type === 'leaf') return null
  for (const c of root.children) {
    const found = findNode(c, id)
    if (found) return found
  }
  return null
}

/* ── Store ── */

interface WorkspaceState {
  workspaces: Record<string, TabWorkspace>
  initWorkspace: (tabId: string) => void
  initWorkspaceWithPaneId: (tabId: string, paneId: string) => void
  /** 初始化包含多个 pane 的工作区（同屏打开） */
  initWorkspaceWithPanes: (tabId: string, panes: { id: string; meta: PaneMeta }[], direction?: SplitDirection) => void
  removeWorkspace: (tabId: string) => void
  splitPane: (tabId: string, paneId: string, direction: SplitDirection) => void
  closePane: (tabId: string, paneId: string) => void
  movePane: (tabId: string, sourceId: string, targetId: string, zone: DropZone) => void
  updateFlexGrow: (tabId: string, nodeId1: string, grow1: number, nodeId2: string, grow2: number) => void
  toggleCollapsed: (tabId: string, paneId: string) => void
  setActivePane: (tabId: string, paneId: string) => void
  getAllPaneIds: (tabId: string) => string[]
  /** 从源标签页提取 pane，返回被提取 pane 的元数据（用于跨标签页转移） */
  extractPane: (sourceTabId: string, paneId: string) => PaneMeta | null
  /** 将外部 pane 插入目标标签页的指定位置（用于标签页拖入分屏） */
  insertPaneAt: (targetTabId: string, targetPaneId: string, insertPaneId: string, zone: DropZone, meta?: PaneMeta) => void
  /** 查询指定 pane 的元数据 */
  getPaneMeta: (tabId: string, paneId: string) => PaneMeta | undefined
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: {},

  initWorkspace: (tabId) => {
    if (get().workspaces[tabId]) return
    const leaf = createLeaf()
    set((s) => ({
      workspaces: {
        ...s.workspaces,
        [tabId]: { rootNode: leaf, activePaneId: leaf.id },
      },
    }))
  },

  initWorkspaceWithPaneId: (tabId, paneId) => {
    if (get().workspaces[tabId]) return
    const leaf: PaneLeaf = { type: 'leaf', id: paneId, flexGrow: 1, collapsed: false }
    set((s) => ({
      workspaces: {
        ...s.workspaces,
        [tabId]: { rootNode: leaf, activePaneId: paneId },
      },
    }))
  },

  initWorkspaceWithPanes: (tabId, panes, direction = 'horizontal') => {
    if (get().workspaces[tabId]) return
    if (panes.length === 0) return
    if (panes.length === 1) {
      const leaf: PaneLeaf = { type: 'leaf', id: panes[0].id, flexGrow: 1, collapsed: false, meta: panes[0].meta }
      set((s) => ({
        workspaces: {
          ...s.workspaces,
          [tabId]: { rootNode: leaf, activePaneId: leaf.id },
        },
      }))
      return
    }
    const leaves: PaneLeaf[] = panes.map(p => ({
      type: 'leaf' as const, id: p.id, flexGrow: 1, collapsed: false, meta: p.meta,
    }))
    const root: SplitBranch = {
      type: 'split',
      id: nextSplitId(),
      direction,
      children: leaves,
      flexGrow: 1,
    }
    set((s) => ({
      workspaces: {
        ...s.workspaces,
        [tabId]: { rootNode: root, activePaneId: leaves[0].id },
      },
    }))
  },

  removeWorkspace: (tabId) => set((s) => {
    const workspaces = { ...s.workspaces }
    delete workspaces[tabId]
    return { workspaces }
  }),

  splitPane: (tabId, paneId, direction) => set((s) => {
    const ws = s.workspaces[tabId]
    if (!ws) return {}
    const newLeaf = createLeaf()
    const newBranch: SplitBranch = {
      type: 'split',
      id: nextSplitId(),
      direction,
      children: [
        { ...findNode(ws.rootNode, paneId)! as PaneLeaf, flexGrow: 1 },
        newLeaf,
      ],
      flexGrow: (findNode(ws.rootNode, paneId) as PaneLeaf)?.flexGrow ?? 1,
    }
    return {
      workspaces: {
        ...s.workspaces,
        [tabId]: {
          rootNode: replaceNode(ws.rootNode, paneId, newBranch),
          activePaneId: newLeaf.id,
        },
      },
    }
  }),

  closePane: (tabId, paneId) => set((s) => {
    const ws = s.workspaces[tabId]
    if (!ws) return {}
    const allIds = collectLeafIds(ws.rootNode)
    if (allIds.length <= 1) return {} // 最后一个不允许关闭
    const newRoot = removeLeaf(ws.rootNode, paneId)
    if (!newRoot) return {}
    const newActive = ws.activePaneId === paneId
      ? collectLeafIds(newRoot)[0]
      : ws.activePaneId
    return {
      workspaces: {
        ...s.workspaces,
        [tabId]: { rootNode: newRoot, activePaneId: newActive },
      },
    }
  }),

  movePane: (tabId, sourceId, targetId, zone) => set((s) => {
    const ws = s.workspaces[tabId]
    if (!ws || sourceId === targetId || zone === 'center') return {}

    // 1. 从树中移除 source
    const sourceNode = findNode(ws.rootNode, sourceId)
    if (!sourceNode || sourceNode.type !== 'leaf') return {}
    const treeAfterRemove = removeLeaf(ws.rootNode, sourceId)
    if (!treeAfterRemove) return {}

    // 2. 在 target 位置插入
    const dir: SplitDirection = (zone === 'left' || zone === 'right') ? 'horizontal' : 'vertical'
    const sourceCopy: PaneLeaf = { ...sourceNode, flexGrow: 1 }
    const targetNode = findNode(treeAfterRemove, targetId)
    if (!targetNode) return {}
    const children: SplitNode[] = (zone === 'left' || zone === 'top')
      ? [sourceCopy, { ...targetNode, flexGrow: 1 }]
      : [{ ...targetNode, flexGrow: 1 }, sourceCopy]
    const newBranch: SplitBranch = {
      type: 'split',
      id: nextSplitId(),
      direction: dir,
      children,
      flexGrow: targetNode.flexGrow,
    }
    const newRoot = replaceNode(treeAfterRemove, targetId, newBranch)
    return {
      workspaces: {
        ...s.workspaces,
        [tabId]: { rootNode: newRoot, activePaneId: sourceId },
      },
    }
  }),

  updateFlexGrow: (tabId, nodeId1, grow1, nodeId2, grow2) => set((s) => {
    const ws = s.workspaces[tabId]
    if (!ws) return {}
    const update = (node: SplitNode): SplitNode => {
      if (node.id === nodeId1) return { ...node, flexGrow: grow1 }
      if (node.id === nodeId2) return { ...node, flexGrow: grow2 }
      if (node.type === 'leaf') return node
      return { ...node, children: node.children.map(update) }
    }
    return {
      workspaces: {
        ...s.workspaces,
        [tabId]: { ...ws, rootNode: update(ws.rootNode) },
      },
    }
  }),

  toggleCollapsed: (tabId, paneId) => set((s) => {
    const ws = s.workspaces[tabId]
    if (!ws) return {}
    const toggle = (node: SplitNode): SplitNode => {
      if (node.type === 'leaf' && node.id === paneId) {
        return { ...node, collapsed: !node.collapsed }
      }
      if (node.type === 'split') {
        return { ...node, children: node.children.map(toggle) }
      }
      return node
    }
    return {
      workspaces: {
        ...s.workspaces,
        [tabId]: { ...ws, rootNode: toggle(ws.rootNode) },
      },
    }
  }),

  setActivePane: (tabId, paneId) => set((s) => {
    const ws = s.workspaces[tabId]
    if (!ws) return {}
    return {
      workspaces: {
        ...s.workspaces,
        [tabId]: { ...ws, activePaneId: paneId },
      },
    }
  }),

  getAllPaneIds: (tabId) => {
    const ws = get().workspaces[tabId]
    if (!ws) return []
    return collectLeafIds(ws.rootNode)
  },

  extractPane: (sourceTabId, paneId) => {
    const ws = get().workspaces[sourceTabId]
    if (!ws) return null
    const allIds = collectLeafIds(ws.rootNode)
    if (allIds.length <= 1) return null // 最后一个 pane 不允许提取
    // 提取前保存 pane 的元数据
    const paneNode = findNode(ws.rootNode, paneId) as PaneLeaf | null
    const meta = paneNode?.meta
    const newRoot = removeLeaf(ws.rootNode, paneId)
    if (!newRoot) return null
    const newActive = ws.activePaneId === paneId
      ? collectLeafIds(newRoot)[0]
      : ws.activePaneId
    set((s) => ({
      workspaces: {
        ...s.workspaces,
        [sourceTabId]: { rootNode: newRoot, activePaneId: newActive },
      },
    }))
    return meta ?? null
  },

  insertPaneAt: (targetTabId, targetPaneId, insertPaneId, zone, meta) => set((s) => {
    const ws = s.workspaces[targetTabId]
    if (!ws || zone === 'center') return {}
    const targetNode = findNode(ws.rootNode, targetPaneId)
    if (!targetNode) return {}
    const dir: SplitDirection = (zone === 'left' || zone === 'right') ? 'horizontal' : 'vertical'
    const newLeaf: PaneLeaf = { type: 'leaf', id: insertPaneId, flexGrow: 1, collapsed: false, meta }
    const children: SplitNode[] = (zone === 'left' || zone === 'top')
      ? [newLeaf, { ...targetNode, flexGrow: 1 }]
      : [{ ...targetNode, flexGrow: 1 }, newLeaf]
    const newBranch: SplitBranch = {
      type: 'split',
      id: nextSplitId(),
      direction: dir,
      children,
      flexGrow: targetNode.flexGrow,
    }
    const newRoot = replaceNode(ws.rootNode, targetPaneId, newBranch)
    return {
      workspaces: {
        ...s.workspaces,
        [targetTabId]: { rootNode: newRoot, activePaneId: insertPaneId },
      },
    }
  }),

  getPaneMeta: (tabId, paneId) => {
    const ws = get().workspaces[tabId]
    if (!ws) return undefined
    const node = findNode(ws.rootNode, paneId)
    if (!node || node.type !== 'leaf') return undefined
    return node.meta
  },
}))
