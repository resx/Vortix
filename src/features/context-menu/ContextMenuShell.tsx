import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useUIStore } from '../../stores/useUIStore'
import { getMenuProvider } from '../../registries/context-menu.registry'
import { MenuGroup } from './components/MenuParts'

export default function ContextMenuShell() {
  const contextMenu = useUIStore((s) => s.contextMenu)
  const hideContextMenu = useUIStore((s) => s.hideContextMenu)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; sourceX: number; sourceY: number } | null>(null)

  const adjustPosition = useCallback(() => {
    if (!menuRef.current || !contextMenu.visible) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 4
    let left = contextMenu.x
    if (left + rect.width > vw - pad) left = vw - rect.width - pad
    if (left < pad) left = pad
    let top = contextMenu.y
    if (top + rect.height > vh - pad) top = vh - rect.height - pad
    if (top < pad) top = pad
    setPosition({ top, left, sourceX: contextMenu.x, sourceY: contextMenu.y })
  }, [contextMenu.visible, contextMenu.x, contextMenu.y])

  useEffect(() => {
    if (!contextMenu.visible) return
    const frame = requestAnimationFrame(adjustPosition)
    return () => cancelAnimationFrame(frame)
  }, [contextMenu.visible, contextMenu.x, contextMenu.y, adjustPosition])

  // Esc 键关闭
  useEffect(() => {
    if (!contextMenu.visible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hideContextMenu() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contextMenu.visible, hideContextMenu])

  const provider = useMemo(
    () => contextMenu.type ? getMenuProvider(contextMenu.type) : null,
    [contextMenu.type],
  )

  const ctx = useMemo(
    () => contextMenu.type
      ? { type: contextMenu.type, data: contextMenu.data, close: hideContextMenu }
      : null,
    [contextMenu.data, contextMenu.type, hideContextMenu],
  )
  const content = useMemo(
    () => provider && ctx ? provider.render(ctx) : null,
    [provider, ctx],
  )

  if (!contextMenu.visible || !contextMenu.type || !provider || !ctx || !content) return null

  const minWidth = provider.minWidth ?? 'min-w-[210px]'
  const resolvedPosition = position && position.sourceX === contextMenu.x && position.sourceY === contextMenu.y
    ? position
    : { top: contextMenu.y, left: contextMenu.x }

  const minWidthPx = minWidth === 'min-w-[260px]' ? 260 : 210

  return (
    <>
      {/* 全屏透明遮罩：拦截菜单外的所有鼠标事件 */}
      <div
        className="fixed inset-0 z-[99]"
        onMouseDown={hideContextMenu}
        onContextMenu={(e) => { e.preventDefault(); hideContextMenu() }}
      />
      <div
        ref={menuRef}
        className={`fixed glass-context rounded-xl py-1 ${minWidth} z-[100]`}
        style={{ top: resolvedPosition.top, left: resolvedPosition.left, '--ctx-menu-w': `${minWidthPx}px` } as React.CSSProperties}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <MenuGroup>
          {content}
        </MenuGroup>
      </div>
    </>
  )
}
