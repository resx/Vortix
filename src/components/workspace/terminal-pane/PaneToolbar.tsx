import type { DragEvent } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useWorkspaceStore } from '../../../stores/useWorkspaceStore'
import type { AppTab } from '../../../types'

interface PaneToolbarProps {
  paneId: string
  tabId: string
  tab: AppTab
  collapsed: boolean
  onDragStart: (e: DragEvent) => void
  paneIndex?: number
  paneLabel?: string
}

export function PaneToolbar({
  paneId,
  tabId,
  tab,
  collapsed,
  onDragStart,
  paneIndex,
  paneLabel,
}: PaneToolbarProps) {
  const toggleCollapsed = useWorkspaceStore((s) => s.toggleCollapsed)
  const closePane = useWorkspaceStore((s) => s.closePane)
  const setActivePane = useWorkspaceStore((s) => s.setActivePane)

  if (collapsed) {
    return (
      <button
        className="absolute top-0 right-0 z-30 w-[26px] h-[26px] flex items-center justify-center rounded-bl-md bg-black/20 backdrop-blur-[2px] text-white/60 hover:bg-black/40 hover:text-white/90 transition-all"
        onClick={(e) => { e.stopPropagation(); toggleCollapsed(tabId, paneId) }}
      >
        <AppIcon icon={icons.chevronLeft} size={14} />
      </button>
    )
  }

  return (
    <div
      className="absolute top-0 right-0 z-30 flex items-center h-[24px] rounded-bl-md bg-black/25 backdrop-blur-[2px] text-white/90 px-1.5 gap-1 select-none hover:bg-black/45 transition-all"
      draggable
      onDragStart={onDragStart}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => setActivePane(tabId, paneId)}
    >
      <AppIcon icon={icons.gripVertical} size={12} className="text-white/60 cursor-grab shrink-0" />
      {paneIndex != null && (
        <span className="text-[10px] text-white/50 font-mono">#{paneIndex}</span>
      )}
      <span className="text-[11px] text-white/80 truncate max-w-[120px]">
        {paneLabel || tab.label || tab.assetRow?.host || 'Terminal'}
      </span>
      <button
        className="p-0.5 rounded hover:bg-white/15 text-white/70 hover:text-white"
        onClick={(e) => { e.stopPropagation(); toggleCollapsed(tabId, paneId) }}
      >
        <AppIcon icon={icons.chevronRight} size={12} />
      </button>
      <button
        className="p-0.5 rounded hover:bg-red-500/30 text-white/70 hover:text-red-300 shrink-0"
        onClick={(e) => { e.stopPropagation(); closePane(tabId, paneId) }}
      >
        <AppIcon icon={icons.close} size={12} />
      </button>
    </div>
  )
}
