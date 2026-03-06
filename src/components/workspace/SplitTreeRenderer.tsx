/* ── 递归分屏树渲染器 ── */

import SplitContainer from './SplitContainer'
import TerminalPane from './TerminalPane'
import { useWorkspaceStore, collectLeafIds } from '../../stores/useWorkspaceStore'
import type { SplitNode } from '../../types/workspace'
import type { AppTab } from '../../types'

interface Props {
  node: SplitNode
  tabId: string
  tab: AppTab
}

export default function SplitTreeRenderer({ node, tabId, tab }: Props) {
  const activePaneId = useWorkspaceStore(s => s.workspaces[tabId]?.activePaneId)
  const rootNode = useWorkspaceStore(s => s.workspaces[tabId]?.rootNode)

  if (node.type === 'leaf') {
    // 计算面板编号：按叶子节点顺序
    let paneIndex: number | undefined
    if (rootNode) {
      const leafIds = collectLeafIds(rootNode)
      if (leafIds.length > 1) {
        paneIndex = leafIds.indexOf(node.id) + 1
      }
    }

    return (
      <TerminalPane
        paneId={node.id}
        tabId={tabId}
        tab={tab}
        collapsed={node.collapsed}
        isActive={node.id === activePaneId}
        paneIndex={paneIndex}
      />
    )
  }

  return <SplitContainer node={node} tabId={tabId} tab={tab} />
}
