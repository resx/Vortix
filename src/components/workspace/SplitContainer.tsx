/* ── 分支节点容器 + Resizer ── */

import { useCallback, useRef } from 'react'
import SplitTreeRenderer from './SplitTreeRenderer'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import type { SplitBranch } from '../../types/workspace'
import type { AppTab } from '../../types'

interface Props {
  node: SplitBranch
  tabId: string
  tab: AppTab
}

const MIN_SIZE = 80 // px

function Resizer({
  direction,
  onResize,
}: {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
}) {
  const startRef = useRef(0)
  const isHorizontal = direction === 'horizontal'

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startRef.current = isHorizontal ? e.clientX : e.clientY
    document.body.classList.add('is-resizing')

    const handleMouseMove = (ev: MouseEvent) => {
      const current = isHorizontal ? ev.clientX : ev.clientY
      const delta = current - startRef.current
      startRef.current = current
      onResize(delta)
    }

    const handleMouseUp = () => {
      document.body.classList.remove('is-resizing')
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [isHorizontal, onResize])

  return (
    <div
      className={`shrink-0 z-10 group
        ${isHorizontal
          ? 'w-[6px] cursor-col-resize hover:bg-primary/30 active:bg-primary/50'
          : 'h-[6px] cursor-row-resize hover:bg-primary/30 active:bg-primary/50'}
        transition-colors`}
      onMouseDown={handleMouseDown}
    >
      <div className={`
        ${isHorizontal ? 'w-[2px] h-full mx-auto' : 'h-[2px] w-full my-auto'}
        bg-border group-hover:bg-primary/60 transition-colors
      `} />
    </div>
  )
}

export default function SplitContainer({ node, tabId, tab }: Props) {
  const updateFlexGrow = useWorkspaceStore(s => s.updateFlexGrow)
  const containerRef = useRef<HTMLDivElement>(null)
  const isHorizontal = node.direction === 'horizontal'

  const handleResize = useCallback((index: number) => (delta: number) => {
    const container = containerRef.current
    if (!container) return
    const children = Array.from(container.children).filter(
      (el) => !(el as HTMLElement).dataset.resizer
    ) as HTMLElement[]

    const prev = children[index]
    const next = children[index + 1]
    if (!prev || !next) return

    const prevSize = isHorizontal ? prev.offsetWidth : prev.offsetHeight
    const nextSize = isHorizontal ? next.offsetWidth : next.offsetHeight
    const totalSize = prevSize + nextSize

    const newPrevSize = Math.max(MIN_SIZE, Math.min(totalSize - MIN_SIZE, prevSize + delta))
    const newNextSize = totalSize - newPrevSize

    // 直接操作 DOM 保证 60fps
    prev.style.flex = `${newPrevSize} 0 0px`
    next.style.flex = `${newNextSize} 0 0px`

    // 同步回 store（节流由 mouseup 处理）
    const child1 = node.children[index]
    const child2 = node.children[index + 1]
    updateFlexGrow(tabId, child1.id, newPrevSize, child2.id, newNextSize)
  }, [isHorizontal, node.children, tabId, updateFlexGrow])

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} w-full h-full min-w-0 min-h-0`}
    >
      {node.children.map((child, i) => (
        <div key={child.id} className="contents">
          {i > 0 && (
            <div data-resizer="true">
              <Resizer direction={node.direction} onResize={handleResize(i - 1)} />
            </div>
          )}
          <div style={{ flex: `${child.flexGrow} 0 0px` }} className="min-w-0 min-h-0 flex">
            <SplitTreeRenderer node={child} tabId={tabId} tab={tab} />
          </div>
        </div>
      ))}
    </div>
  )
}
