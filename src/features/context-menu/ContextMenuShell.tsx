import { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore } from '../../stores/useUIStore'
import { getMenuProvider } from '../../registries/context-menu.registry'

export default function ContextMenuShell() {
  const contextMenu = useUIStore((s) => s.contextMenu)
  const hideContextMenu = useUIStore((s) => s.hideContextMenu)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

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
    setPosition({ top, left })
  }, [contextMenu.visible, contextMenu.x, contextMenu.y])

  useEffect(() => {
    if (contextMenu.visible) {
      setPosition({ top: contextMenu.y, left: contextMenu.x })
      requestAnimationFrame(adjustPosition)
    }
  }, [contextMenu.visible, contextMenu.x, contextMenu.y, adjustPosition])

  useEffect(() => {
    const close = () => hideContextMenu()
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [hideContextMenu])

  if (!contextMenu.visible || !contextMenu.type) return null

  const provider = getMenuProvider(contextMenu.type)
  if (!provider) return null

  const ctx = { type: contextMenu.type, data: contextMenu.data, close: hideContextMenu }
  const minWidth = provider.minWidth ?? 'min-w-[210px]'

  return (
    <div
      ref={menuRef}
      className={`fixed glass-context rounded-xl py-1 ${minWidth} z-[100]`}
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {provider.render(ctx)}
    </div>
  )
}
