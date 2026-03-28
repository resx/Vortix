import type { ComponentType } from 'react'
import { AppIcon } from '../../icons/AppIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'

export function SidebarHeaderButton({
  icon,
  tooltipText,
  disabled = false,
  onClick,
  className = '',
}: {
  icon: string | ComponentType<{ className?: string }>
  tooltipText: string
  disabled?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={!disabled ? onClick : undefined}
          className={`p-[5px] rounded-md flex items-center justify-center transition-colors
            ${disabled ? 'text-text-disabled cursor-not-allowed' : 'text-text-1 hover:text-text-1 hover:bg-bg-hover'} ${className}`}
        >
          {typeof icon === 'string'
            ? <AppIcon icon={icon} size={14} />
            : (() => {
              const C = icon
              return <C className="w-3.5 h-3.5" />
            })()}
        </button>
      </TooltipTrigger>
      {!disabled && <TooltipContent side="bottom">{tooltipText}</TooltipContent>}
    </Tooltip>
  )
}
