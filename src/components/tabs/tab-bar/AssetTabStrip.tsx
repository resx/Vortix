import { AppIcon, icons } from '../../icons/AppIcon'
import { ProtocolIcon } from '../../icons/ProtocolIcons'
import { getColorTagDotClass } from '../../../lib/color-tag'
import type { AppTab } from '../../../types'
import type { ContextMenuState } from '../../../types'

interface AssetTabStripProps {
  tabs: AppTab[]
  activeTabId: string
  closeLeft: boolean
  middleClickCloseTab: boolean
  dragSourceRef: React.MutableRefObject<string | null>
  dragIndicator: { tabId: string; side: 'left' | 'right' } | null
  setDragIndicator: (value: { tabId: string; side: 'left' | 'right' } | null) => void
  closeTab: (tabId: string) => void
  openTabView: (tabId: string) => void
  reorderTab: (sourceId: string, targetId: string) => void
  showContextMenu: (x: number, y: number, type: ContextMenuState['type'], data?: ContextMenuState['data']) => void
}

export function AssetTabStrip({
  tabs,
  activeTabId,
  closeLeft,
  middleClickCloseTab,
  dragSourceRef,
  dragIndicator,
  setDragIndicator,
  closeTab,
  openTabView,
  reorderTab,
  showContextMenu,
}: AssetTabStripProps) {
  const assetTabs = tabs.filter((t) => t.type === 'asset')

  return (
    <>
      {assetTabs.map((tab, index) => {
        const isActive = activeTabId === tab.id
        const prevIsActive = index > 0 && activeTabId === assetTabs[index - 1].id

        const closeBtn = (
          <button
            className="shrink-0 p-0.5 rounded text-text-3/0 group-hover:text-text-3 hover:!text-text-1 hover:!bg-border/40 transition-all"
            onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
          >
            <AppIcon icon={icons.close} size={12} />
          </button>
        )

        return (
          <div key={tab.id} className="flex items-center h-full">
            {index > 0 && !isActive && !prevIsActive && (
              <div className="w-px h-3.5 bg-border/50 shrink-0" />
            )}
            <div
              className={`group relative flex items-center gap-1.5 h-full text-[12px] cursor-pointer transition-colors ${
                closeLeft ? 'pl-1.5 pr-2.5' : 'pl-2.5 pr-1.5'
              } ${
                isActive
                  ? 'font-medium text-text-1 bg-bg-card'
                  : 'text-text-3 hover:text-text-2 hover:bg-border/20'
              }`}
              draggable
              onDragStart={(e) => {
                dragSourceRef.current = tab.id
                e.dataTransfer.setData('text/tab-id', tab.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => { dragSourceRef.current = null; setDragIndicator(null) }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('text/tab-id')) return
                e.preventDefault()
                e.stopPropagation()
                e.dataTransfer.dropEffect = 'move'
                if (dragSourceRef.current === tab.id) { setDragIndicator(null); return }
                const rect = e.currentTarget.getBoundingClientRect()
                const side = (e.clientX - rect.left) < rect.width / 2 ? 'left' : 'right'
                setDragIndicator({ tabId: tab.id, side })
              }}
              onDragLeave={() => {
                if (dragIndicator?.tabId === tab.id) setDragIndicator(null)
              }}
              onDrop={(e) => {
                const fromId = e.dataTransfer.getData('text/tab-id')
                if (fromId && fromId !== tab.id) {
                  e.preventDefault()
                  e.stopPropagation()
                  reorderTab(fromId, tab.id)
                }
                setDragIndicator(null)
              }}
              onClick={() => openTabView(tab.id)}
              onMouseDown={(e) => {
                if (e.button === 1 && middleClickCloseTab) {
                  e.preventDefault()
                  e.stopPropagation()
                  closeTab(tab.id)
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                showContextMenu(e.clientX, e.clientY, 'tab-context', { tabId: tab.id, tabIndex: index })
              }}
            >
              {dragIndicator?.tabId === tab.id && dragIndicator.side === 'left' && (
                <div className="absolute left-0 top-[6px] bottom-[6px] w-[2px] bg-primary rounded-full" />
              )}

              {closeLeft && closeBtn}

              <ProtocolIcon protocol={tab.assetRow?.protocol} size={12} />
              {getColorTagDotClass(tab.assetRow?.colorTag) && (
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getColorTagDotClass(tab.assetRow?.colorTag)}`} />
              )}
              <span className="max-w-[80px] truncate">{tab.label}</span>

              {!isActive && tab.hasActivity && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
              )}

              {!closeLeft && closeBtn}

              {isActive && (
                <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-primary rounded-full" />
              )}
              {!isActive && tab.status === 'connecting' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border overflow-hidden">
                  <div className="h-full bg-primary/50 animate-[loading_1.5s_ease-out_forwards]" />
                </div>
              )}
              {!isActive && tab.status === 'connected' && (
                <div className="absolute bottom-0 left-2 right-2 h-[1.5px] bg-text-3/25 rounded-full" />
              )}

              {dragIndicator?.tabId === tab.id && dragIndicator.side === 'right' && (
                <div className="absolute right-0 top-[6px] bottom-[6px] w-[2px] bg-primary rounded-full" />
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
