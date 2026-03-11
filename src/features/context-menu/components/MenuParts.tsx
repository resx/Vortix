import { useEffect, useRef, useState, useCallback, createContext, useContext, useId, useMemo } from 'react'
import { AppIcon, icons } from '../../../components/icons/AppIcon'

/* ---- MenuGroup 上下文：协调同级子菜单的互斥展开 ---- */
const MenuGroupContext = createContext<{
  activeId: string | null
  setActiveId: (id: string | null) => void
} | null>(null)

export function MenuGroup({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const value = useMemo(() => ({ activeId, setActiveId }), [activeId])
  return (
    <MenuGroupContext.Provider value={value}>
      {children}
    </MenuGroupContext.Provider>
  )
}

/* ---- MenuItem ---- */
export function MenuItem({
  icon, iconNode, label, shortcut, hasSubmenu, disabled, onClick, children,
}: {
  icon?: string; iconNode?: React.ReactNode; label: string; shortcut?: string
  hasSubmenu?: boolean; disabled?: boolean; onClick?: () => void; children?: React.ReactNode
}) {
  const itemRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [subPos, setSubPos] = useState<{ top?: string; bottom?: string; left?: string; right?: string }>({})
  const group = useContext(MenuGroupContext)
  const id = useId()

  // 子菜单展开由上下文驱动：仅当指针移到同级其他选项时关闭
  const showSub = !!hasSubmenu && !disabled && group?.activeId === id

  const handleMouseEnter = useCallback(() => {
    if (disabled) return
    group?.setActiveId(hasSubmenu ? id : null)
  }, [disabled, hasSubmenu, group, id])

  useEffect(() => {
    if (!showSub || !itemRef.current || !submenuRef.current) return
    const parentRect = itemRef.current.getBoundingClientRect()
    const subRect = submenuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 4
    const pos: typeof subPos = {}
    if (parentRect.right + subRect.width + gap > vw) {
      pos.right = `calc(100% + ${gap}px)`
    } else {
      pos.left = `calc(100% + ${gap}px)`
    }
    const idealTop = parentRect.top - 6
    if (idealTop + subRect.height > vh) {
      const idealBottom = vh - parentRect.bottom - 6
      if (idealBottom >= 0 && parentRect.bottom - subRect.height + 6 >= 0) {
        pos.bottom = '-6px'
      } else {
        pos.top = `${vh - parentRect.top - subRect.height}px`
      }
    } else {
      pos.top = '-6px'
    }
    const frame = requestAnimationFrame(() => {
      setSubPos(pos)
    })
    return () => cancelAnimationFrame(frame)
  }, [showSub])
  return (
    <div
      ref={itemRef}
      className={`group/item relative flex items-center justify-between px-3 h-[32px] mx-1 my-[2px] rounded-lg text-[13px] transition-colors select-none
        ${disabled ? 'text-text-disabled cursor-not-allowed' : 'text-text-1 hover:bg-bg-active cursor-pointer'}`}
      onMouseEnter={handleMouseEnter}
      onClick={() => { if (!disabled && !hasSubmenu && onClick) onClick() }}
    >
      <div className="flex items-center gap-3">
        {iconNode ? (
          <span className="flex h-[20px] w-[20px] items-center justify-center transition-colors text-current opacity-90 group-hover/item:opacity-100 shrink-0">
            {iconNode}
          </span>
        ) : icon ? (
          <span className="flex h-[20px] w-[20px] items-center justify-center shrink-0">
            <AppIcon icon={icon} size={16} className={`transition-colors ${disabled ? 'text-text-disabled' : 'text-current opacity-80 group-hover/item:opacity-100'}`} />
          </span>
        ) : null}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {shortcut && <span className={`text-[11px] font-sans ${disabled ? 'text-text-disabled' : 'text-text-3'}`}>{shortcut}</span>}
        {hasSubmenu && <AppIcon icon={icons.chevronRight} size={13} className={disabled ? 'text-text-disabled' : 'text-text-3'} />}
      </div>
      {hasSubmenu && children && showSub && (
        <MenuGroup>
          <div
            ref={submenuRef}
            className="absolute glass-context rounded-xl py-1 min-w-[var(--ctx-menu-w,210px)] w-max z-[101] pointer-events-auto"
            style={subPos}
          >
            {children}
          </div>
        </MenuGroup>
      )}
    </div>
  )
}

/* ---- MenuDivider ---- */
export function MenuDivider() {
  return <div className="h-px bg-border/60 mx-1.5 my-0.5" />
}

/* ---- ActionButton ---- */
export function ActionButton({ icon, tooltip, disabled, onClick }: { icon: string; tooltip: string; disabled: boolean; onClick?: () => void }) {
  return (
    <div className="group/action relative flex items-center">
      <button onClick={!disabled ? onClick : undefined} className={`px-[6px] py-[4px] rounded-md transition-colors ${disabled ? 'text-text-disabled cursor-not-allowed' : 'hover:bg-bg-active hover:text-primary text-text-2'}`}>
        <AppIcon icon={icon} size={12} />
      </button>
      {!disabled && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/action:flex items-center justify-center z-[150]">
          <div className="bg-tooltip-bg text-tooltip-text text-[11px] px-2 py-1.5 rounded-md shadow-lg whitespace-nowrap font-medium">
            {tooltip}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-t-[4px] border-t-tooltip-bg border-x-[4px] border-x-transparent" />
        </div>
      )}
    </div>
  )
}

/* ---- MenuHeader ---- */
export function MenuHeader({ label }: { label: string }) {
  return <div className="px-4 py-1 text-[11px] text-text-1 font-medium">{label}</div>
}
