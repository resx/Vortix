import { type ReactNode, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, icons } from '../../icons/AppIcon'
import { extractDescText, extractLegacyDesc } from './tooltip-utils'
import { useSettingRowTooltip } from './useSettingRowTooltip'

export function SettingRow({ label, desc, children }: {
  label: string
  desc?: ReactNode
  children: ReactNode
}) {
  const explicitDesc = useMemo(() => extractDescText(desc), [desc])
  const legacy = useMemo(() => extractLegacyDesc(children), [children])
  const descText = explicitDesc || legacy.descText
  const hasDesc = descText.length > 0
  const {
    closeTooltip,
    open,
    openTooltip,
    tooltipPos,
    tooltipRef,
    triggerRef,
  } = useSettingRowTooltip()

  return (
    <div className="group island-row flex justify-between items-center px-4 py-1.5 gap-3 mb-0.5 last:mb-0">
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        <span className="text-[12px] text-text-2 font-medium whitespace-nowrap">{label}</span>
        {hasDesc && (
          <>
            <button
              ref={triggerRef}
              type="button"
              className="w-[16px] h-[16px] rounded-full border border-border/80 bg-bg-base/85 text-text-3 hover:text-primary hover:border-primary/30 transition-colors flex items-center justify-center"
              aria-label={`${label} ??`}
              onMouseEnter={openTooltip}
              onMouseLeave={closeTooltip}
              onFocus={openTooltip}
              onBlur={closeTooltip}
            >
              <AppIcon icon={icons.info} size={10} />
            </button>
            {open && createPortal(
              <div
                ref={tooltipRef}
                className="pointer-events-none fixed z-[1400] w-[260px] rounded-lg border border-border/80 bg-bg-card/96 px-2.5 py-2 text-[11px] leading-[1.45] text-text-2 shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-md"
                style={{ top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px` }}
              >
                {descText}
              </div>,
              document.body,
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-end flex-1 min-w-0">
        <div className="w-full min-w-0 flex items-center justify-end [&>*]:max-w-full">{legacy.content}</div>
      </div>
    </div>
  )
}
