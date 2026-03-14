/* ── 窗口控制按钮 ── */

import { useState } from 'react'
import { AppIcon, icons } from '../../components/icons/AppIcon'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip'
import { minimizeWindow, maximizeWindow, closeWindow, togglePinWindow, isPinned } from '../../lib/window'

export default function WindowControls() {
  const [pinned, setPinned] = useState(isPinned)

  const handlePin = async () => {
    const next = await togglePinWindow()
    setPinned(next)
  }

  return (
    <div className="flex items-center gap-4 text-text-2 ml-2 border-l border-border pl-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={handlePin} className={`hover:text-text-1 transition-colors ${pinned ? 'text-primary' : ''}`}>
            <AppIcon icon={pinned ? icons.pinOff : icons.pin} size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{pinned ? '取消置顶' : '置顶'}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={minimizeWindow} className="hover:text-text-1 transition-colors">
            <AppIcon icon={icons.minimize} size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent>最小化</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={maximizeWindow} className="hover:text-text-1 transition-colors">
            <AppIcon icon={icons.maximize} size={12} />
          </button>
        </TooltipTrigger>
        <TooltipContent>最大化</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={closeWindow} className="hover:text-text-1 transition-colors hover:text-status-error">
            <AppIcon icon={icons.close} size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent>关闭</TooltipContent>
      </Tooltip>
    </div>
  )
}
