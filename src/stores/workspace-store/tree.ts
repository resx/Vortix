import type { PaneLeaf, SplitBranch, SplitDirection, SplitNode } from '../../types/workspace'

let paneCounter = 0
export function nextPaneId() {
  return `pane-${++paneCounter}`
}

let splitCounter = 0
export function nextSplitId() {
  return `split-${++splitCounter}`
}

export function createLeaf(id?: string): PaneLeaf {
  return { type: 'leaf', id: id ?? nextPaneId(), flexGrow: 1, collapsed: false }
}

export function createSplitBranch(direction: SplitDirection, children: SplitNode[], flexGrow = 1): SplitBranch {
  return {
    type: 'split',
    id: nextSplitId(),
    direction,
    children,
    flexGrow,
  }
}

export function collectLeafIds(node: SplitNode): string[] {
  if (node.type === 'leaf') return [node.id]
  return node.children.flatMap(collectLeafIds)
}

export function findNode(root: SplitNode, id: string): SplitNode | null {
  if (root.id === id) return root
  if (root.type === 'leaf') return null
  for (const child of root.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

export function replaceNode(root: SplitNode, targetId: string, replacement: SplitNode): SplitNode {
  if (root.id === targetId) return replacement
  if (root.type === 'leaf') return root
  return {
    ...root,
    children: root.children.map((child) => replaceNode(child, targetId, replacement)),
  }
}

export function removeLeaf(root: SplitNode, leafId: string): SplitNode | null {
  if (root.type === 'leaf') {
    return root.id === leafId ? null : root
  }
  const remaining = root.children
    .map((child) => removeLeaf(child, leafId))
    .filter((child): child is SplitNode => child !== null)

  if (remaining.length === 0) return null
  if (remaining.length === 1) {
    const child = remaining[0]
    return { ...child, flexGrow: root.flexGrow }
  }
  return { ...root, children: remaining }
}
