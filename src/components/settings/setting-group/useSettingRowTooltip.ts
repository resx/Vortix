import { useEffect, useRef, useState } from 'react'
import { resolveSettingTooltipPosition, type SettingTooltipPosition } from './tooltip-utils'

export function useSettingRowTooltip() {
  const [open, setOpen] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<SettingTooltipPosition>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const syncTooltipPosition = () => {
    const nextPosition = resolveSettingTooltipPosition(triggerRef.current, tooltipRef.current)
    if (nextPosition) setTooltipPos(nextPosition)
  }

  const openTooltip = () => {
    syncTooltipPosition()
    setOpen(true)
  }

  const closeTooltip = () => {
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    const raf = window.requestAnimationFrame(syncTooltipPosition)
    const onRelayout = () => syncTooltipPosition()
    window.addEventListener('resize', onRelayout)
    window.addEventListener('scroll', onRelayout, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', onRelayout)
      window.removeEventListener('scroll', onRelayout, true)
    }
  }, [open])

  return {
    closeTooltip,
    open,
    openTooltip,
    tooltipPos,
    tooltipRef,
    triggerRef,
  }
}
