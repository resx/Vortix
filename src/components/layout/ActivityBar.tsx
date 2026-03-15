import { useAssetStore } from '../../stores/useAssetStore'
import { useUIStore } from '../../stores/useUIStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import { AppIcon, icons } from '../icons/AppIcon'
import { ProtocolIcon } from '../icons/ProtocolIcons'
import type { ActiveFilter } from '../../types'
import type { ReactNode } from 'react'

function TooltipButton({
  icon,
  iconNode,
  isActive,
  disabled,
  tooltipText,
  onClick,
}: {
  icon?: string
  iconNode?: ReactNode
  isActive: boolean
  disabled?: boolean
  tooltipText: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          className={`w-[32px] h-[32px] rounded-[10px] transition-colors flex items-center justify-center ${
            disabled
              ? 'text-text-3/40 cursor-not-allowed'
              : isActive ? 'bg-border text-text-1' : 'text-text-3 hover:bg-border/60'
          }`}
        >
          {iconNode ?? <AppIcon icon={icon!} size={18} />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltipText}</TooltipContent>
    </Tooltip>
  )
}

const filterItems: { key: ActiveFilter; icon: string; tooltip: string; disabled?: boolean }[] = [
  { key: 'all', icon: icons.list, tooltip: '显示全部' },
  { key: 'ssh', icon: icons.terminal, tooltip: '显示终端/SSH资产' },
  { key: 'db', icon: icons.database, tooltip: '数据库（即将推出）', disabled: true },
  { key: 'docker', icon: icons.container, tooltip: 'Docker（即将推出）', disabled: true },
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
          icon={isSidebarOpen ? icons.folderOpen : icons.folder}
          isActive={isSidebarOpen}
          onClick={toggleSidebar}
          tooltipText={isSidebarOpen ? '隐藏资产树' : '显示资产树'}
        />
      </div>

      <div className="w-[24px] h-px bg-border mb-2" />

      <div className="flex flex-col gap-1.5 w-full items-center">
        {filterItems.map(({ key, icon, tooltip, disabled }) => (
          <TooltipButton
            key={key}
            icon={key === 'docker' ? undefined : icon}
            iconNode={key === 'docker' ? <ProtocolIcon protocol="docker" size={18} mono /> : undefined}
            isActive={activeFilter === key}
            disabled={disabled}
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
