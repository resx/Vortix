/* ── 工作区根容器 ── */
/* 每个 asset tab 渲染一个，负责初始化 workspace 并渲染分屏树 */

import { useEffect } from 'react'
import SplitTreeRenderer from './SplitTreeRenderer'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import type { AppTab } from '../../types'

interface Props {
  tab: AppTab
}

export default function WorkspaceLayout({ tab }: Props) {
  const initWorkspace = useWorkspaceStore(s => s.initWorkspace)
  const workspace = useWorkspaceStore(s => s.workspaces[tab.id])

  useEffect(() => {
    initWorkspace(tab.id)
  }, [tab.id, initWorkspace])

  if (!workspace) return null

  return (
    <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
      <SplitTreeRenderer node={workspace.rootNode} tabId={tab.id} tab={tab} />
    </div>
  )
}
