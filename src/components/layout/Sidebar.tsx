import {
  Search, Crosshair, Link as LinkIcon, CopyPlus,
  ChevronRight, ChevronDown, Folder, ArrowUpRight,
  FolderPlus, Terminal, Container, Monitor, Network,
  Usb, Database,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuSeparator,
} from '../ui/dropdown-menu'
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
            ${disabled ? 'text-text-disabled cursor-not-allowed' : 'text-text-1 hover:text-text-1 hover:bg-bg-hover'} ${className}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      {!disabled && <TooltipContent side="bottom">{tooltipText}</TooltipContent>}
    </Tooltip>
  )
}

/* 新建资产下拉菜单 */
function NewAssetDropdown() {
  const openSshConfig = useAppStore((s) => s.openSshConfig)
  const setShowDirModal = useAppStore((s) => s.setShowDirModal)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-[5px] rounded-md flex items-center justify-center transition-colors text-text-1 hover:bg-bg-hover">
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={6}>
        <DropdownMenuItem onSelect={() => setShowDirModal(true)}>
          <div className="flex items-center gap-2.5">
            <FolderPlus className="w-3.5 h-3.5 text-text-2" />
            <span>目录</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <div className="flex items-center gap-2.5">
            <Terminal className="w-3.5 h-3.5 text-text-2" />
            <span>本地终端</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <div className="flex items-center gap-2.5">
            <Container className="w-3.5 h-3.5 text-text-2" />
            <span>Docker</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* 远程连接子菜单 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Monitor className="w-3.5 h-3.5 text-text-2" />
            <span>远程连接</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6}>
            <DropdownMenuItem onSelect={() => openSshConfig('create')}>
              <div className="flex items-center gap-2.5">
                <Terminal className="w-3.5 h-3.5 text-text-2" />
                <span>SSH</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center gap-2.5">
                <Network className="w-3.5 h-3.5 text-text-2" />
                <span>SSH隧道</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center gap-2.5">
                <Monitor className="w-3.5 h-3.5 text-text-2" />
                <span>RDP</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center gap-2.5">
                <Monitor className="w-3.5 h-3.5 text-text-2" />
                <span>Telnet</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center gap-2.5">
                <Usb className="w-3.5 h-3.5 text-text-2" />
                <span>串口</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 数据库子菜单 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Database className="w-3.5 h-3.5 text-text-2" />
            <span>数据库</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6}>
            {['Redis', 'MySQL', 'MariaDB', 'PostgreSQL', 'SqlServer', 'ClickHouse', 'SQLite', 'Oracle', '达梦'].map((db) => (
              <DropdownMenuItem key={db}>
                <div className="flex items-center gap-2.5">
                  <Database className="w-3.5 h-3.5 text-text-2" />
                  <span>{db}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function Sidebar() {
  const activeFilter = useAppStore((s) => s.activeFilter)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const assets = useAppStore((s) => s.assets)
  const shortcuts = useAppStore((s) => s.shortcuts)
  const toggleFolder = useAppStore((s) => s.toggleFolder)
  const expandAllFolders = useAppStore((s) => s.expandAllFolders)
  const collapseAllFolders = useAppStore((s) => s.collapseAllFolders)
  const showContextMenu = useAppStore((s) => s.showContextMenu)
  const openAssetTab = useAppStore((s) => s.openAssetTab)
  const currentFolder = useAppStore((s) => s.currentFolder)
  const setCurrentFolder = useAppStore((s) => s.setCurrentFolder)
  const moveConnectionToFolder = useAppStore((s) => s.moveConnectionToFolder)
  const selectedItemId = useAppStore((s) => s.selectedSidebarItemId)
  const setSelectedItemId = useAppStore((s) => s.setSelectedSidebarItemId)
  const hideEmptyFolders = useSettingsStore((s) => s.hideEmptyFolders)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const isShortcuts = activeFilter === 'shortcuts'
  const isAll = activeFilter === 'all'
  const title = isShortcuts ? '快捷命令' : '资产列表'
  const data = isShortcuts ? shortcuts : assets
  const target = isShortcuts ? 'shortcuts' as const : 'assets' as const
  // "显示全部"和"快捷命令"下不启用隐藏空文件夹
  const disableHideEmptyFolders = isAll || isShortcuts

  // 判断是否所有文件夹都已展开
  const allExpanded = data.filter(i => i.type === 'folder').every(i => i.isOpen)

  // 按筛选类型匹配协议
  const protocolMap: Record<string, string[]> = {
    ssh: ['ssh', 'sftp'],
    db: ['database'],
    docker: ['docker'],
  }
  const activeProtocols = protocolMap[activeFilter] ?? null

  // 判断连接项是否匹配当前筛选
  const matchesFilter = (item: typeof data[number]) => {
    if (isAll || isShortcuts) return true
    return !!item.protocol && !!activeProtocols && activeProtocols.includes(item.protocol)
  }

  // 根据当前筛选类型判断文件夹是否为空
  const isFolderEmpty = (item: typeof data[number]) => {
    if (item.type !== 'folder' || !item.children) return true
    if (isAll) return item.children.length === 0
    return !item.children.some(matchesFilter)
  }

  // 筛选数据：过滤不匹配的根目录连接 + 隐藏空文件夹
  const filteredData = data
    .filter(item => {
      // 根目录连接项：按协议筛选
      if (item.type === 'connection') return matchesFilter(item)
      // 文件夹：隐藏空文件夹开启时过滤
      if (item.type === 'folder' && hideEmptyFolders && !disableHideEmptyFolders) return !isFolderEmpty(item)
      return true
    })

  const handleContextMenu = (e: React.MouseEvent, type: 'sidebar-blank-shortcut' | 'sidebar-shortcut' | 'sidebar-blank-asset' | 'sidebar-asset', item?: typeof data[number]) => {
    e.preventDefault()
    e.stopPropagation()
    showContextMenu(e.clientX, e.clientY, type, item ?? null)
  }

  return (
    <div
      id="sidebar"
      className="bg-bg-card rounded-xl border border-border shadow-sm flex flex-col shrink-0 select-none transition-all duration-300 overflow-hidden"
      style={{ width: isSidebarOpen ? '270px' : '0px', opacity: isSidebarOpen ? 1 : 0 }}
    >
      <div className="w-[270px] flex flex-col h-full">
        {/* 侧边栏头部工具栏 */}
        <div id="sidebar-header" className="h-[40px] flex items-center justify-between px-3 border-b border-border shrink-0">
          <span className="text-[13px] font-bold text-text-1 tracking-wide">{title}</span>
          <div className="flex items-center gap-0.5 text-text-1">
            <SidebarHeaderButton icon={Search} tooltipText="搜索" />
            <SidebarHeaderButton icon={Crosshair} tooltipText="定位到选中项" />
            <SidebarHeaderButton icon={CopyPlus} tooltipText={allExpanded ? '折叠所有' : '展开所有'} onClick={() => allExpanded ? collapseAllFolders(target) : expandAllFolders(target)} />
            <SidebarHeaderButton
              icon={FolderEyeIcon}
              tooltipText={hideEmptyFolders ? '显示空文件夹' : '隐藏空文件夹'}
              disabled={disableHideEmptyFolders}
              onClick={() => updateSetting('hideEmptyFolders', !hideEmptyFolders)}
              className={hideEmptyFolders && !disableHideEmptyFolders ? 'bg-border text-text-1' : ''}
            />
            {isShortcuts ? (
              <SidebarHeaderButton icon={LinkIcon} tooltipText="创建快捷命令" />
            ) : (
              <NewAssetDropdown />
            )}
          </div>
        </div>

        {/* 树形视图 */}
        <div
          id="sidebar-tree"
          className="flex-1 overflow-y-auto py-1.5 px-1 custom-scrollbar relative"
          onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-blank-shortcut' : 'sidebar-blank-asset')}
        >
          {filteredData.map(item => (
            <div key={item.id} className="flex flex-col">
              {item.type === 'folder' ? (
                <>
                  {/* 文件夹项 */}
                  <div
                    className={`flex items-center px-1 py-1.5 rounded-md hover:bg-bg-hover cursor-pointer transition-colors
                      ${selectedItemId === item.id ? 'bg-primary/10 text-primary' : ''}`}
                    onClick={() => {
                      setSelectedItemId(item.id)
                      setCurrentFolder(currentFolder === item.id ? null : item.id)
                    }}
                    onDoubleClick={() => {
                      toggleFolder(target, item.id)
                    }}
                    onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', item)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.add('ring-2', 'ring-primary/50')
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('ring-2', 'ring-primary/50')
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.currentTarget.classList.remove('ring-2', 'ring-primary/50')
                      const connectionId = e.dataTransfer.getData('text/connection-id')
                      if (connectionId) {
                        moveConnectionToFolder(connectionId, item.id)
                      }
                    }}
                  >
                    <span
                      className="w-4 flex justify-center text-text-3 cursor-pointer hover:text-text-1"
                      onClick={(e) => { e.stopPropagation(); toggleFolder(target, item.id) }}
                    >
                      {item.isOpen
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                    <span className="w-5 flex justify-center mr-1">
                      <Folder className="w-3.5 h-3.5 text-icon-folder fill-icon-folder" />
                    </span>
                    <span className="text-[12px] text-text-2 truncate flex-1">{item.name}</span>
                  </div>

                  {item.isOpen && item.children?.filter(matchesFilter).map(child => (
                    <div
                      key={child.id}
                      className={`flex items-center px-1 py-1.5 pl-[28px] rounded-md hover:bg-bg-hover cursor-pointer transition-colors
                        ${selectedItemId === child.id ? 'bg-primary/10 text-primary' : ''}`}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/connection-id', child.id); e.dataTransfer.effectAllowed = 'move' }}
                      onClick={() => setSelectedItemId(child.id)}
                      onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', child)}
                      onDoubleClick={() => {
                        if (child.type === 'connection') {
                          openAssetTab({
                            id: child.id,
                            name: child.name,
                            type: 'asset',
                            protocol: child.protocol,
                            latency: '-',
                            host: '-',
                            user: '-',
                            created: '-',
                            expire: '-',
                            remark: '-',
                          })
                        }
                      }}
                    >
                      <span className="w-5 flex justify-center mr-1">
                        <div className="bg-border/50 p-0.5 rounded text-text-3">
                          <Terminal className="w-3 h-3" />
                        </div>
                      </span>
                      <span className="text-[12px] text-text-2 truncate flex-1">{child.name}</span>
                    </div>
                  ))}
                </>
              ) : (
                /* 顶层连接项（无文件夹的 SSH 资产） */
                <div
                  className={`flex items-center px-1 py-1.5 rounded-md hover:bg-bg-hover cursor-pointer transition-colors
                    ${selectedItemId === item.id ? 'bg-primary/10 text-primary' : ''}`}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/connection-id', item.id); e.dataTransfer.effectAllowed = 'move' }}
                  onClick={() => setSelectedItemId(item.id)}
                  onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', item)}
                  onDoubleClick={() => {
                    openAssetTab({
                      id: item.id,
                      name: item.name,
                      type: 'asset',
                      protocol: item.protocol,
                      latency: '-',
                      host: '-',
                      user: '-',
                      created: '-',
                      expire: '-',
                      remark: '-',
                    })
                  }}
                >
                  <span className="w-4 flex justify-center" />
                  <span className="w-5 flex justify-center mr-1">
                    <div className="bg-border/50 p-0.5 rounded text-text-3">
                      <Terminal className="w-3 h-3" />
                    </div>
                  </span>
                  <span className="text-[12px] text-text-2 truncate flex-1">{item.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
