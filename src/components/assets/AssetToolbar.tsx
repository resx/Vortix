import { useRef, useEffect } from 'react'
import {
  Home, RefreshCw, Link as LinkIcon, FolderPlus, Eye, EyeOff,
  ChevronDown, ChevronRight, AlignJustify,
  Terminal, Package, Monitor, Database, Network, Usb,
} from 'lucide-react'
import { PingIcon, PingOffIcon } from '../icons/CustomIcons'
import { useAppStore } from '../../stores/useAppStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import type { LucideIcon } from 'lucide-react'

/* 工具栏按钮 + tooltip */
function ToolbarActionBtn({
  icon: Icon,
  tooltip,
  onClick,
}: {
  icon: LucideIcon | typeof PingIcon
  tooltip: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
          className="p-1 rounded-md text-text-2 hover:bg-bg-hover hover:text-text-1 transition-colors"
        >
          <Icon className="w-[15px] h-[15px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

/* 新建下拉菜单项 */
function DropdownMenuItem({
  icon: Icon,
  label,
  hasSubmenu,
  submenuKey,
}: {
  icon: LucideIcon
  label: string
  hasSubmenu?: boolean
  submenuKey?: string
}) {
  const activeNewSubmenu = useAppStore((s) => s.activeNewSubmenu)
  const setActiveNewSubmenu = useAppStore((s) => s.setActiveNewSubmenu)

  return (
    <div
      className="relative flex items-center justify-between px-3 h-[34px] mx-1.5 my-[2px] rounded-lg text-[13px] text-text-1 hover:bg-primary hover:text-white cursor-pointer group select-none"
      onMouseEnter={() => hasSubmenu && setActiveNewSubmenu(submenuKey ?? null)}
      onMouseLeave={() => hasSubmenu && setActiveNewSubmenu(null)}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="w-3.5 h-3.5 text-text-2 group-hover:text-white transition-colors" />
        <span>{label}</span>
      </div>
      {hasSubmenu && <ChevronRight className="w-3.5 h-3.5 text-text-3 group-hover:text-white" />}

      {hasSubmenu && activeNewSubmenu === submenuKey && (
        <div className="absolute top-0 left-full pl-1 z-[101]">
          <div className="bg-bg-card/75 backdrop-blur-2xl border border-bg-card/60 rounded-xl shadow-lg py-1.5 min-w-[150px]">
            {submenuKey === 'remote' && (
              <>
                <SubItem icon={Terminal} label="SSH" />
                <SubItem icon={Network} label="SSH隧道" />
                <SubItem icon={Monitor} label="RDP" />
                <SubItem icon={Monitor} label="Telnet" />
                <SubItem icon={Usb} label="串口" />
              </>
            )}
            {submenuKey === 'db' && (
              <>
                <SubItem icon={Database} label="Redis" />
                <SubItem icon={Database} label="MySQL" />
                <SubItem icon={Database} label="MariaDB" />
                <SubItem icon={Database} label="PostgreSQL" />
                <SubItem icon={Database} label="SqlServer" />
                <SubItem icon={Database} label="ClickHouse" />
                <SubItem icon={Database} label="SQLite" />
                <SubItem icon={Database} label="Oracle" />
                <SubItem icon={Database} label="达梦" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SubItem({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="px-3 py-1.5 hover:bg-bg-hover text-text-1 text-[13px] flex items-center gap-2 cursor-pointer">
      <Icon className="w-3.5 h-3.5 text-text-2" />
      {label}
    </div>
  )
}

export default function AssetToolbar() {
  const showPing = useAppStore((s) => s.showPing)
  const togglePing = useAppStore((s) => s.togglePing)
  const refreshPing = useAppStore((s) => s.refreshPing)
  const isAnonymized = useAppStore((s) => s.isAnonymized)
  const toggleAnonymized = useAppStore((s) => s.toggleAnonymized)
  const setAssetHidden = useAppStore((s) => s.setAssetHidden)
  const setCurrentFolder = useAppStore((s) => s.setCurrentFolder)
  const setShowDirModal = useAppStore((s) => s.setShowDirModal)
  const newMenuOpen = useAppStore((s) => s.newMenuOpen)
  const setNewMenuOpen = useAppStore((s) => s.setNewMenuOpen)

  const newMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false)
      }
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [setNewMenuOpen])

  return (
    <div id="asset-toolbar" className="h-[44px] border-b border-border flex items-center justify-between px-3 shrink-0">
      <div className="flex items-center gap-2">
        <AlignJustify className="w-3.5 h-3.5 text-text-3" />
        <span className="text-[13px] font-medium text-text-1">资产列表</span>
        <span className="text-[12px] text-text-3 ml-4">已选择 0 个连接</span>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative mr-2">
          <input
            type="text"
            placeholder="名称,IP,User (Ctrl+Shift+F)"
            className="w-[200px] border border-border rounded-lg px-2.5 py-0.5 text-[12px] text-text-1 placeholder-text-3 outline-none focus:border-primary shadow-sm transition-colors"
          />
        </div>

        <ToolbarActionBtn icon={Home} tooltip="回到首页" onClick={() => setCurrentFolder(null)} />
        <ToolbarActionBtn icon={RefreshCw} tooltip="刷新" onClick={refreshPing} />
        <ToolbarActionBtn icon={showPing ? PingIcon : PingOffIcon} tooltip={showPing ? '隐藏ping' : '显示ping'} onClick={togglePing} />

        {/* 新建下拉 */}
        <div className="relative" ref={newMenuRef}>
          <ToolbarActionBtn icon={LinkIcon} tooltip="新建" onClick={() => setNewMenuOpen(!newMenuOpen)} />
          {newMenuOpen && (
            <div className="absolute top-full right-0 mt-2 bg-bg-card/75 backdrop-blur-2xl border border-bg-card/60 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.1)] py-1.5 min-w-[140px] z-[101]">
              <DropdownMenuItem icon={FolderPlus} label="目录" />
              <DropdownMenuItem icon={Terminal} label="本地终端" />
              <DropdownMenuItem icon={Package} label="Docker" />
              <DropdownMenuItem icon={Monitor} label="远程连接" hasSubmenu submenuKey="remote" />
              <DropdownMenuItem icon={Database} label="数据库" hasSubmenu submenuKey="db" />
            </div>
          )}
        </div>

        <ToolbarActionBtn icon={FolderPlus} tooltip="新建目录" onClick={() => setShowDirModal(true)} />
        <ToolbarActionBtn icon={isAnonymized ? EyeOff : Eye} tooltip={isAnonymized ? '脱敏:已启用' : '脱敏:已关闭'} onClick={toggleAnonymized} />
        <ToolbarActionBtn icon={ChevronDown} tooltip="隐藏资产列表" onClick={() => setAssetHidden(true)} />
      </div>
    </div>
  )
}
