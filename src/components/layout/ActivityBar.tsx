import {
  Folder, Terminal, Database, Package, Zap, List,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
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
    <div className="group relative w-full flex justify-center">
      <button
        onClick={onClick}
        className={`w-[32px] h-[32px] rounded-full transition-colors flex items-center justify-center ${
          isActive ? 'bg-[#E5E6EB] text-[#1F2329]' : 'text-[#86909C] hover:bg-[#E5E6EB]/60'
        }`}
      >
        <Icon className="w-[18px] h-[18px]" />
      </button>
      {/* Tooltip */}
      <div className="absolute left-[44px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-[9999]">
        <div className="w-0 h-0 border-y-[4px] border-y-transparent border-r-[4px] border-r-[#2D2D2D]" />
        <div className="bg-[#2D2D2D] text-white text-[12px] px-2 py-1.5 rounded-md whitespace-nowrap shadow-xl leading-none font-medium tracking-wide">
          {tooltipText}
        </div>
      </div>
    </div>
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

  return (
    <div id="activity-bar" className="w-[48px] flex flex-col items-center py-2 shrink-0 select-none z-20">
      {/* 侧边栏折叠按钮 */}
      <div className="w-full mb-2 flex justify-center">
        <TooltipButton
          icon={Folder}
          isActive={isSidebarOpen}
          onClick={toggleSidebar}
          tooltipText="显示/隐藏侧边栏"
        />
      </div>

      <div className="w-[24px] h-px bg-[#E5E6EB] mb-2" />

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
          onClick={() => setActiveFilter('shortcuts')}
          tooltipText="显示快捷命令"
        />
      </div>
    </div>
  )
}
