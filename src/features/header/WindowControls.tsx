/* ── 窗口控制按钮 ── */

import { AppIcon, icons } from '../icons/AppIcon'
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip'

const windowIcons: { icon: string; label: string; small?: boolean }[] = [
  { icon: icons.pin, label: '置顶' },
  { icon: icons.minimize, label: '最小化' },
  { icon: icons.maximize, label: '最大化', small: true },
  { icon: icons.close, label: '关闭' },
]

export default function WindowControls() {
  return (
    <div className="flex items-center gap-4 text-text-2 ml-2 border-l border-border pl-4">
      {windowIcons.map(({ icon, label, small }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <button className="hover:text-text-1 transition-colors">
              <AppIcon icon={icon} size={small ? 12 : 15} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
