import { useRef, useEffect } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { ProtocolIcon, DB_LABEL_PROTOCOL } from '../icons/ProtocolIcons'
import { PingIcon, PingOffIcon } from '../icons/CustomIcons'
import { useAssetStore } from '../../stores/useAssetStore'
import { useUIStore } from '../../stores/useUIStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'

/* 工具栏按钮 + tooltip */
function ToolbarActionBtn({
  icon,
  tooltip,
  onClick,
}: {
  icon: string | typeof PingIcon
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
          {typeof icon === 'string' ? <AppIcon icon={icon} size={15} /> : (() => { const C = icon; return <C className="w-[15px] h-[15px]" /> })()}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

/* 新建下拉菜单项 */
function DropdownMenuItem({
  icon,
  label,
  hasSubmenu,
  submenuKey,
  onClick,
}: {
  icon: string
  label: string
  hasSubmenu?: boolean
  submenuKey?: string
  onClick?: () => void
}) {
  const activeNewSubmenu = useUIStore((s) => s.activeNewSubmenu)
  const setActiveNewSubmenu = useUIStore((s) => s.setActiveNewSubmenu)

  return (
    <div
      className="relative flex items-center justify-between px-3 h-[34px] mx-1.5 my-[2px] rounded-lg text-[13px] text-text-1 hover:bg-primary hover:text-white cursor-pointer group select-none"
      onMouseEnter={() => hasSubmenu && setActiveNewSubmenu(submenuKey ?? null)}
      onMouseLeave={() => hasSubmenu && setActiveNewSubmenu(null)}
      onClick={() => { if (!hasSubmenu && onClick) onClick() }}
    >
      <div className="flex items-center gap-2.5">
        <AppIcon icon={icon} size={14} className="text-text-2 group-hover:text-white transition-colors" />
        <span>{label}</span>
      </div>
      {hasSubmenu && <AppIcon icon={icons.chevronRight} size={14} className="text-text-3 group-hover:text-white" />}

      {hasSubmenu && activeNewSubmenu === submenuKey && (
        <div className="absolute top-0 left-full pl-1 z-[101]">
          <div className="bg-bg-card/75 backdrop-blur-2xl border border-bg-card/60 rounded-xl shadow-lg py-1.5 min-w-[150px]">
            {submenuKey === 'remote' && (
              <>
                <SubItem icon={icons.terminal} label="SSH" />
                <SubItem icon={icons.network} label="SSH隧道" />
                <SubItem icon={icons.screenShare} label="RDP" />
                <SubItem icon={icons.monitor} label="Telnet" />
                <SubItem icon={icons.usb} label="串口" />
              </>
            )}
            {submenuKey === 'db' && (
              <>
                {['Redis', 'MySQL', 'MariaDB', 'PostgreSQL', 'SqlServer', 'ClickHouse', 'SQLite', 'Oracle', '达梦'].map((db) => (
                  <SubItem key={db} iconNode={<ProtocolIcon protocol={DB_LABEL_PROTOCOL[db]} size={14} mono className="text-text-1" />} label={db} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SubItem({ icon, iconNode, label }: { icon?: string; iconNode?: React.ReactNode; label: string }) {
  return (
    <div className="px-3 py-1.5 hover:bg-bg-hover text-text-1 text-[13px] flex items-center gap-2 cursor-pointer">
      {iconNode || (icon && <AppIcon icon={icon} size={14} className="text-text-2" />)}
      {label}
    </div>
  )
}

export default function AssetToolbar() {
  const showPing = useAssetStore((s) => s.showPing)
  const togglePing = useAssetStore((s) => s.togglePing)
  const refreshPing = useAssetStore((s) => s.refreshPing)
  const fetchAssets = useAssetStore((s) => s.fetchAssets)
  const isAnonymized = useAssetStore((s) => s.isAnonymized)
  const toggleAnonymized = useAssetStore((s) => s.toggleAnonymized)
  const setAssetHidden = useAssetStore((s) => s.setAssetHidden)
  const setCurrentFolder = useAssetStore((s) => s.setCurrentFolder)
  const setShowDirModal = useUIStore((s) => s.setShowDirModal)
  const newMenuOpen = useUIStore((s) => s.newMenuOpen)
  const setNewMenuOpen = useUIStore((s) => s.setNewMenuOpen)
  const openLocalTermConfig = useUIStore((s) => s.openLocalTermConfig)
  const selectedRowIds = useAssetStore((s) => s.selectedRowIds)

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
        <AppIcon icon={icons.alignJustify} size={14} className="text-text-3" />
        <span className="text-[13px] font-medium text-text-1">资产列表</span>
        <span className="text-[12px] text-text-3 ml-4">已选择 {selectedRowIds.size} 个连接</span>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative mr-2">
          <input
            type="text"
            placeholder="名称,IP,User (Ctrl+Shift+F)"
            className="w-[200px] border border-border rounded-lg px-2.5 py-0.5 text-[12px] text-text-1 placeholder-text-3 outline-none focus:border-primary shadow-sm transition-colors"
          />
        </div>

        <ToolbarActionBtn icon={icons.home} tooltip="回到首页" onClick={() => setCurrentFolder(null)} />
        <ToolbarActionBtn icon={icons.refresh} tooltip="刷新" onClick={() => { fetchAssets(); if (showPing) refreshPing() }} />
        <ToolbarActionBtn icon={showPing ? PingIcon : PingOffIcon} tooltip={showPing ? '隐藏ping' : '显示ping'} onClick={togglePing} />

        {/* 新建下拉 */}
        <div className="relative" ref={newMenuRef}>
          <ToolbarActionBtn icon={icons.link} tooltip="新建" onClick={() => setNewMenuOpen(!newMenuOpen)} />
          {newMenuOpen && (
            <div className="absolute top-full right-0 mt-2 bg-bg-card/75 backdrop-blur-2xl border border-bg-card/60 rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.1)] py-1.5 min-w-[140px] z-[101]">
              <DropdownMenuItem icon={icons.folderPlus} label="目录" />
              <DropdownMenuItem icon={icons.localTerminal} label="本地终端" onClick={() => { setNewMenuOpen(false); openLocalTermConfig('create') }} />
              <DropdownMenuItem icon={icons.container} label="Docker" />
              <DropdownMenuItem icon={icons.screenShare} label="远程连接" hasSubmenu submenuKey="remote" />
              <DropdownMenuItem icon={icons.database} label="数据库" hasSubmenu submenuKey="db" />
            </div>
          )}
        </div>

        <ToolbarActionBtn icon={icons.folderPlus} tooltip="新建目录" onClick={() => setShowDirModal(true)} />
        <ToolbarActionBtn icon={isAnonymized ? icons.eyeOff : icons.eye} tooltip={isAnonymized ? '脱敏:已启用' : '脱敏:已关闭'} onClick={toggleAnonymized} />
        <ToolbarActionBtn icon={icons.chevronDown} tooltip="隐藏资产列表" onClick={() => setAssetHidden(true)} />
      </div>
    </div>
  )
}
