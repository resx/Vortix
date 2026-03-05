import { useState } from 'react'

interface HoverTooltipProps {
  text: string
  children: React.ReactNode
  disabled?: boolean
}

export default function HoverTooltip({ text, children, disabled = false }: HoverTooltipProps) {
  const [show, setShow] = useState(false)

  if (disabled) return <>{children}</>

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-tooltip-bg text-tooltip-text text-xs px-3 py-2 rounded-md whitespace-nowrap z-50 shadow-xl animate-in fade-in zoom-in-95 duration-100">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-tooltip-bg" />
        </div>
      )}
    </div>
  )
}
