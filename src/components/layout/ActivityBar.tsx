import { useAssetStore } from '../../stores/useAssetStore'
import { useUIStore } from '../../stores/useUIStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { AppIcon, icons } from '../icons/AppIcon'
import type { ActiveFilter } from '../../types'

function TooltipButton({
  icon,
  isActive,
  tooltipText,
  onClick,
}: {
  icon: string
  isActive: boolean
  tooltipText: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`w-[32px] h-[32px] rounded-[10px] transition-colors flex items-center justify-center ${
            isActive ? 'bg-border text-text-1' : 'text-text-3 hover:bg-border/60'
          }`}
        >
          <AppIcon icon={icon} size={18} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltipText}</TooltipContent>
    </Tooltip>
  )
}

const filterItems: { key: ActiveFilter; icon: string; tooltip: string }[] = [
  { key: 'all', icon: icons.list, tooltip: '显示全部' },
  { key: 'ssh', icon: icons.terminal, tooltip: '显示终端/SSH资产' },
  { key: 'db', icon: icons.database, tooltip: '显示数据库资产' },
  { key: 'docker', icon: icons.container, tooltip: '显示Docker资产' },
]

export default function ActivityBar() {
  const activeFilter = useAssetStore((s) => s.activeFilter)
  const setActiveFilter = useAssetStore((s) => s.setActiveFilter)
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const handleShortcutsClick = () => {
    setActiveFilter('shortcuts')
    if (!isSidebarOpen) toggleSidebar()
  }

  return (
    <div id="activity-bar" className="w-[48px] flex flex-col items-center py-2 shrink-0 select-none z-20">
      <div className="w-full mb-2 flex justify-center">
        <TooltipButton
          icon={icons.folder}
          isActive={isSidebarOpen}
          onClick={toggleSidebar}
          tooltipText={isSidebarOpen ? '隐藏资产树' : '显示资产树'}
        />
      </div>

      <div className="w-[24px] h-px bg-border mb-2" />

      <div className="flex flex-col gap-1.5 w-full items-center">
        {filterItems.map(({ key, icon, tooltip }) => (
          <TooltipButton
            key={key}
            icon={icon}
            isActive={activeFilter === key}
            onClick={() => setActiveFilter(key)}
            tooltipText={tooltip}
          />
        ))}
      </div>

      <div className="mt-auto mb-1 w-full flex justify-center">
        <TooltipButton
          icon={icons.zap}
          isActive={activeFilter === 'shortcuts'}
          onClick={handleShortcutsClick}
          tooltipText="显示快捷命令"
        />
      </div>
    </div>
  )
}
