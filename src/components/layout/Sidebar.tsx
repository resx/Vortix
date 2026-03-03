import {
  Search, Crosshair, Link as LinkIcon, CopyPlus,
  ChevronRight, ChevronDown, Folder, ArrowUpRight,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import type { LucideIcon } from 'lucide-react'

/* 自定义 FolderEye 图标 */
function FolderEyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="M9 13.5c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5-1.5 2.5-3 2.5-3-1-3-2.5Z" />
      <circle cx="12" cy="13.5" r="1" />
    </svg>
  )
}

/* 侧边栏头部按钮 */
function SidebarHeaderButton({
  icon: Icon,
  tooltipText,
  disabled = false,
  onClick,
  className = '',
}: {
  icon: LucideIcon | typeof FolderEyeIcon
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
            ${disabled ? 'text-[#C9CDD4] cursor-not-allowed' : 'text-[#1F2329] hover:text-[#1F2329] hover:bg-[#F2F3F5]'} ${className}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      {!disabled && <TooltipContent side="bottom">{tooltipText}</TooltipContent>}
    </Tooltip>
  )
}

export default function Sidebar() {
  const activeFilter = useAppStore((s) => s.activeFilter)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const hideEmptyFolders = useAppStore((s) => s.hideEmptyFolders)
  const toggleHideEmptyFolders = useAppStore((s) => s.toggleHideEmptyFolders)
  const assets = useAppStore((s) => s.assets)
  const shortcuts = useAppStore((s) => s.shortcuts)
  const toggleFolder = useAppStore((s) => s.toggleFolder)
  const showContextMenu = useAppStore((s) => s.showContextMenu)

  const isShortcuts = activeFilter === 'shortcuts'
  const isAll = activeFilter === 'all'
  const title = isShortcuts ? '快捷命令' : '资产列表'
  const data = isShortcuts ? shortcuts : assets
  const target = isShortcuts ? 'shortcuts' as const : 'assets' as const
  const disableHideEmptyFolders = isAll || isShortcuts

  const handleContextMenu = (e: React.MouseEvent, type: 'sidebar-blank-shortcut' | 'sidebar-shortcut' | 'sidebar-blank-asset' | 'sidebar-asset', item?: typeof data[number]) => {
    e.preventDefault()
    e.stopPropagation()
    showContextMenu(e.clientX, e.clientY, type, item ?? null)
  }

  return (
    <div
      id="sidebar"
      className="bg-white rounded-xl border border-[#E5E6EB] shadow-sm flex flex-col shrink-0 select-none transition-all duration-300 overflow-hidden"
      style={{ width: isSidebarOpen ? '270px' : '0px', opacity: isSidebarOpen ? 1 : 0 }}
    >
      <div className="w-[270px] flex flex-col h-full">
        {/* 侧边栏头部工具栏 */}
        <div id="sidebar-header" className="h-[40px] flex items-center justify-between px-3 border-b border-[#E5E6EB] shrink-0">
          <span className="text-[13px] font-bold text-[#1F2329] tracking-wide">{title}</span>
          <div className="flex items-center gap-0.5 text-[#1F2329]">
            <SidebarHeaderButton icon={Search} tooltipText="搜索" />
            <SidebarHeaderButton icon={Crosshair} tooltipText="定位到选中项" />
            <SidebarHeaderButton icon={CopyPlus} tooltipText="点击全部展开" />
            <SidebarHeaderButton
              icon={FolderEyeIcon}
              tooltipText="点击隐藏空文件夹"
              disabled={disableHideEmptyFolders}
              onClick={toggleHideEmptyFolders}
              className={hideEmptyFolders && !disableHideEmptyFolders ? 'bg-[#E5E6EB] text-[#1F2329]' : ''}
            />
            <SidebarHeaderButton icon={LinkIcon} tooltipText={isShortcuts ? '创建快捷命令' : '新建连接'} />
          </div>
        </div>

        {/* 树形视图 */}
        <div
          id="sidebar-tree"
          className="flex-1 overflow-y-auto py-1.5 px-1 custom-scrollbar relative"
          onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-blank-shortcut' : 'sidebar-blank-asset')}
        >
          {data.map(item => (
            <div key={item.id} className="flex flex-col">
              <div
                className="flex items-center px-1 py-1.5 rounded-md hover:bg-[#F2F3F5] cursor-pointer"
                onClick={() => toggleFolder(target, item.id)}
                onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', item)}
              >
                <span className="w-4 flex justify-center text-[#86909C]">
                  {item.isOpen
                    ? <ChevronDown className="w-3.5 h-3.5" />
                    : <ChevronRight className="w-3.5 h-3.5" />}
                </span>
                <span className="w-5 flex justify-center mr-1">
                  <Folder className="w-3.5 h-3.5 text-[#FADC19] fill-[#FADC19]" />
                </span>
                <span className="text-[12px] text-[#4E5969] truncate flex-1">{item.name}</span>
              </div>

              {item.isOpen && item.children?.map(child => (
                <div
                  key={child.id}
                  className="flex items-center px-1 py-1.5 pl-[28px] rounded-md hover:bg-[#F2F3F5] cursor-pointer"
                  onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', child)}
                >
                  <span className="w-5 flex justify-center mr-1">
                    <div className="bg-[#E5E6EB]/50 p-0.5 rounded text-[#86909C]">
                      <ArrowUpRight className="w-3 h-3" />
                    </div>
                  </span>
                  <span className="text-[12px] text-[#4E5969] truncate flex-1">{child.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
