import { useEffect, useRef, useState, useCallback } from 'react'
import { AppIcon, icons } from '../../../components/icons/AppIcon'

/* ---- MenuItem ---- */
export function MenuItem({
  icon, iconNode, label, shortcut, hasSubmenu, disabled, onClick, children,
}: {
  icon?: string; iconNode?: React.ReactNode; label: string; shortcut?: string
  hasSubmenu?: boolean; disabled?: boolean; onClick?: () => void; children?: React.ReactNode
}) {
  const itemRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [showSub, setShowSub] = useState(false)
  const [subPos, setSubPos] = useState<{ top?: string; bottom?: string; left?: string; right?: string }>({})
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const openSubmenu = useCallback(() => {
    if (disabled || !hasSubmenu) return
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setShowSub(true)
  }, [disabled, hasSubmenu])

  const closeSubmenu = useCallback(() => {
    hideTimer.current = setTimeout(() => setShowSub(false), 150)
  }, [])

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
    setSubPos(pos)
  }, [showSub])
  return (
    <div
      ref={itemRef}
      className={`group/item relative flex items-center justify-between px-2.5 h-[28px] mx-1 my-[2px] rounded-md text-[12px] transition-colors select-none
        ${disabled ? 'text-text-disabled cursor-not-allowed' : 'text-text-1 hover:bg-bg-active cursor-pointer'}`}
      onMouseEnter={openSubmenu}
      onMouseLeave={closeSubmenu}
      onClick={() => { if (!disabled && !hasSubmenu && onClick) onClick() }}
    >
      <div className="flex items-center gap-2.5">
        {iconNode ? <span className="transition-colors">{iconNode}</span> : icon ? <AppIcon icon={icon} size={12} className={`transition-colors ${disabled ? 'text-text-disabled' : 'text-text-2 group-hover/item:text-primary'}`} /> : null}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {shortcut && <span className={`text-[10px] font-sans ${disabled ? 'text-text-disabled' : 'text-text-3'}`}>{shortcut}</span>}
        {hasSubmenu && <AppIcon icon={icons.chevronRight} size={12} className={disabled ? 'text-text-disabled' : 'text-text-3'} />}
      </div>
      {hasSubmenu && children && !disabled && showSub && (
        <div
          ref={submenuRef}
          className="absolute glass-context rounded-xl py-1 w-max z-[101] pointer-events-auto"
          style={subPos}
          onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current) }}
          onMouseLeave={closeSubmenu}
        >
          {children}
        </div>
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