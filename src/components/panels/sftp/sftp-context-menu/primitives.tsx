import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AppIcon, icons } from '../../../icons/AppIcon'

export function Item({ icon, label, onClick, disabled }: {
  icon: string
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 h-[32px] mx-1 my-[1px] rounded-lg text-[13px] select-none transition-colors
        ${disabled ? 'text-text-disabled cursor-not-allowed' : 'text-text-1 hover:bg-bg-active cursor-pointer'}`}
      onClick={() => { if (!disabled) onClick() }}
    >
      <AppIcon icon={icon} size={15} className="opacity-80 shrink-0" />
      <span>{label}</span>
    </div>
  )
}

export function Divider() {
  return <div className="h-px bg-border/60 mx-1.5 my-0.5" />
}

export function SubMenu({ icon, label, children }: {
  icon: string
  label: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !ref.current || !subRef.current) return
    const rect = ref.current.getBoundingClientRect()
    const subEl = subRef.current
    const sub = subEl.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pos: Partial<CSSProperties> = {
      left: '',
      right: '',
      top: '',
      bottom: '',
      marginLeft: '',
      marginRight: '',
    }
    if (rect.right + sub.width + 4 > vw) {
      pos.right = '100%'
      pos.marginRight = '4px'
    } else {
      pos.left = '100%'
      pos.marginLeft = '4px'
    }
    if (rect.top + sub.height > vh) {
      pos.bottom = '0px'
    } else {
      pos.top = '-6px'
    }
    Object.assign(subEl.style, pos)
  }, [open])

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-center justify-between px-3 h-[32px] mx-1 my-[1px] rounded-lg text-[13px] text-text-1 hover:bg-bg-active cursor-pointer select-none">
        <div className="flex items-center gap-3">
          <AppIcon icon={icon} size={15} className="opacity-80 shrink-0" />
          <span>{label}</span>
        </div>
        <AppIcon icon={icons.chevronRight} size={13} className="text-text-3" />
      </div>
      {open && (
        <div
          ref={subRef}
          className="absolute glass-context rounded-xl py-1 min-w-[180px] w-max z-[101]"
        >
          {children}
        </div>
      )}
    </div>
  )
}
