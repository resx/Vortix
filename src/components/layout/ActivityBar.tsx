import {
  Folder, Terminal, Database, Package, Zap, List,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import type { ActiveFilter } from '../../types'
import type { LucideIcon } from 'lucide-react'

function TooltipButton({
  icon: Icon,
  isActive,
  tooltipText,
  onClick,
}: {
  icon: LucideIcon
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
          <Icon className="w-[18px] h-[18px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{tooltipText}</TooltipContent>
    </Tooltip>
  )
}

const filterItems: { key: ActiveFilter; icon: LucideIcon; tooltip: string }[] = [
  { key: 'all', icon: List, tooltip: '显示全部' },
  { key: 'ssh', icon: Terminal, tooltip: '显示终端/SSH资产' },
  { key: 'db', icon: Database, tooltip: '显示数据库资产' },
  { key: 'docker', icon: Package, tooltip: '显示Docker资产' },
]

export default function ActivityBar() {
  const activeFilter = useAppStore((s) => s.activeFilter)
  const setActiveFilter = useAppStore((s) => s.setActiveFilter)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  // 快捷命令按钮：折叠态下同时展开 sidebar
  const handleShortcutsClick = () => {
    setActiveFilter('shortcuts')
    if (!isSidebarOpen) toggleSidebar()
  }

  return (
    <div id="activity-bar" className="w-[48px] flex flex-col items-center py-2 shrink-0 select-none z-20">
      {/* 显示/隐藏资产树按钮 */}
      <div className="w-full mb-2 flex justify-center">
        <TooltipButton
          icon={Folder}
          isActive={isSidebarOpen}
          onClick={toggleSidebar}
          tooltipText={isSidebarOpen ? '隐藏资产树' : '显示资产树'}
        />
      </div>

      <div className="w-[24px] h-px bg-border mb-2" />

      {/* 筛选按钮 */}
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

      {/* 底部快捷命令 */}
      <div className="mt-auto mb-1 w-full flex justify-center">
        <TooltipButton
          icon={Zap}
          isActive={activeFilter === 'shortcuts'}
          onClick={handleShortcutsClick}
          tooltipText="显示快捷命令"
        />
      </div>
    </div>
  )
}
