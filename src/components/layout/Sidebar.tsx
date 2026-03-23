import { useRef, useState, type ComponentType } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { ProtocolIcon, DB_LABEL_PROTOCOL } from '../icons/ProtocolIcons'
import { useAssetStore } from '../../stores/useAssetStore'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { getColorTagTextClass } from '../../lib/color-tag'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuSubContent, DropdownMenuSeparator,
} from '../ui/dropdown-menu'

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

function FolderEyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="M9 13.5c0-1.5 1.5-2.5 3-2.5 1.02 0 2 .46 2.57 1.3" />
      <path d="M15 13.5c0 .65-.28 1.26-.76 1.68" />
      <circle cx="12" cy="13.5" r="1" />
      <path d="m8 9 8 9" />
    </svg>
  )
}

/* 侧边栏头部按钮 */
function SidebarHeaderButton({
  icon,
  tooltipText,
  disabled = false,
  onClick,
  className = '',
}: {
  icon: string | ComponentType<{ className?: string }>
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
          {typeof icon === 'string' ? <AppIcon icon={icon} size={14} /> : (() => { const C = icon; return <C className="w-3.5 h-3.5" /> })()}
        </button>
      </TooltipTrigger>
      {!disabled && <TooltipContent side="bottom">{tooltipText}</TooltipContent>}
    </Tooltip>
  )
}

/* 新建资产下拉菜单 */
function NewAssetDropdown() {
  const openSshConfig = useUIStore((s) => s.openSshConfig)
  const openLocalTermConfig = useUIStore((s) => s.openLocalTermConfig)
  const setShowDirModal = useUIStore((s) => s.setShowDirModal)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-[5px] rounded-md flex items-center justify-center transition-colors text-text-1 hover:bg-bg-hover">
          <AppIcon icon={icons.link} size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={6}>
        <DropdownMenuItem onSelect={() => setShowDirModal(true)}>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.folderPlus} size={14} className="text-text-2" />
            <span>目录</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openLocalTermConfig('create')}>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.localTerminal} size={14} className="text-text-2" />
            <span>本地终端</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <div className="flex items-center gap-2.5">
            <AppIcon icon={icons.container} size={14} className="text-text-2" />
            <span>Docker</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* 远程连接子菜单 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <AppIcon icon={icons.screenShare} size={14} className="text-text-2" />
            <span>远程连接</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6}>
            <DropdownMenuItem onSelect={() => openSshConfig('create')}>
              <div className="flex items-center gap-2.5">
                <AppIcon icon={icons.terminal} size={14} className="text-text-2" />
                <span>SSH</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center gap-2.5">
                <AppIcon icon={icons.network} size={14} className="text-text-2" />
                <span>SSH隧道</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center gap-2.5">
                <AppIcon icon={icons.screenShare} size={14} className="text-text-2" />
                <span>RDP</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center gap-2.5">
                <AppIcon icon={icons.monitor} size={14} className="text-text-2" />
                <span>Telnet</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <div className="flex items-center gap-2.5">
                <AppIcon icon={icons.usb} size={14} className="text-text-2" />
                <span>串口</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 数据库子菜单 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <AppIcon icon={icons.database} size={14} className="text-text-2" />
            <span>数据库</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6}>
            {['Redis', 'MySQL', 'MariaDB', 'PostgreSQL', 'SqlServer', 'ClickHouse', 'SQLite', 'Oracle', '达梦'].map((db) => (
              <DropdownMenuItem key={db}>
                <div className="flex items-center gap-2.5">
                  <ProtocolIcon protocol={DB_LABEL_PROTOCOL[db]} variant="menu" size={14} mono className="text-text-1" />
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
  const activeFilter = useAssetStore((s) => s.activeFilter)
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen)
  const assets = useAssetStore((s) => s.assets)
  const shortcuts = useShortcutStore((s) => s.shortcuts)
  const toggleAssetFolder = useAssetStore((s) => s.toggleFolder)
  const expandAssetFolders = useAssetStore((s) => s.expandAllFolders)
  const collapseAssetFolders = useAssetStore((s) => s.collapseAllFolders)
  const toggleShortcutGroup = useShortcutStore((s) => s.toggleShortcutGroup)
  const expandShortcutGroups = useShortcutStore((s) => s.expandShortcutGroups)
  const collapseShortcutGroups = useShortcutStore((s) => s.collapseShortcutGroups)
  const showContextMenu = useUIStore((s) => s.showContextMenu)
  const openAssetTab = useTabStore((s) => s.openAssetTab)
  const currentFolder = useAssetStore((s) => s.currentFolder)
  const setCurrentFolder = useAssetStore((s) => s.setCurrentFolder)
  const moveConnectionToFolder = useAssetStore((s) => s.moveConnectionToFolder)
  const selectedItemId = useAssetStore((s) => s.selectedSidebarItemId)
  const setSelectedItemId = useAssetStore((s) => s.setSelectedSidebarItemId)
  const openShortcutDialog = useShortcutStore((s) => s.openShortcutDialog)
  const executeShortcut = useShortcutStore((s) => s.executeShortcut)
  const moveShortcutsToGroup = useShortcutStore((s) => s.moveShortcutsToGroup)
  const selectedShortcutIds = useShortcutStore((s) => s.selectedShortcutIds)
  const lastSelectedShortcutId = useShortcutStore((s) => s.lastSelectedShortcutId)
  const setShortcutSelection = useShortcutStore((s) => s.setShortcutSelection)
  const clearShortcutSelection = useShortcutStore((s) => s.clearShortcutSelection)
  const hideEmptyFolders = useSettingsStore((s) => s.hideEmptyFolders)
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const draggingShortcutIdsRef = useRef<string[]>([])
  const [isShortcutDragging, setIsShortcutDragging] = useState(false)
  const [draggingShortcutIds, setDraggingShortcutIds] = useState<string[]>([])
  const [shortcutDropTarget, setShortcutDropTarget] = useState<string | null>(null)

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

  const selectedShortcutIdSet = new Set(selectedShortcutIds)
  const draggingShortcutIdSet = new Set(draggingShortcutIds)
  const visibleShortcutOrder = isShortcuts
    ? filteredData.flatMap((item) => {
      if (item.type === 'folder') {
        if (!item.isOpen) return []
        return (item.children ?? []).filter(matchesFilter).map((child) => child.id)
      }
      return [item.id]
    })
    : []

  const parseDraggedShortcutIds = (e: React.DragEvent, fallbackId?: string) => {
    if (draggingShortcutIdsRef.current.length > 0) {
      return [...draggingShortcutIdsRef.current]
    }
    const encoded = e.dataTransfer.getData('application/x-vortix-shortcut-ids')
    if (encoded?.trim()) {
      try {
        const parsed = JSON.parse(encoded)
        if (Array.isArray(parsed)) {
          const ids = parsed.map((v) => String(v)).filter(Boolean)
          if (ids.length > 0) return ids
        }
      } catch {
        // ignore malformed payload
      }
    }
    const single = e.dataTransfer.getData('text/connection-id')
    if (single?.trim()) {
      return [single.trim()]
    }
    const plain = e.dataTransfer.getData('text/plain')
    if (plain?.trim()) {
      return [plain.trim()]
    }
    return fallbackId ? [fallbackId] : []
  }

  const parseDraggedConnectionId = (e: React.DragEvent): string => {
    const typed = e.dataTransfer.getData('text/connection-id')
    if (typed?.trim()) return typed.trim()
    const plain = e.dataTransfer.getData('text/plain')
    return plain?.trim() ?? ''
  }

  const resetShortcutDragState = () => {
    draggingShortcutIdsRef.current = []
    setIsShortcutDragging(false)
    setDraggingShortcutIds([])
    setShortcutDropTarget(null)
  }

  const commitShortcutDrop = (e: React.DragEvent, targetGroupName: string) => {
    e.preventDefault()
    const ids = parseDraggedShortcutIds(e)
    if (ids.length > 0) {
      void moveShortcutsToGroup(ids, targetGroupName)
    }
    resetShortcutDragState()
  }

  const hydrateShortcutDragState = () => {
    if (isShortcutDragging) return
    const ids = [...draggingShortcutIdsRef.current]
    if (ids.length === 0) return
    setIsShortcutDragging(true)
    setDraggingShortcutIds(ids)
  }

  const handleShortcutClick = (e: React.MouseEvent, id: string) => {
    const order = visibleShortcutOrder
    const isCtrlOrMeta = e.ctrlKey || e.metaKey
    const current = new Set(selectedShortcutIds)

    if (e.shiftKey && lastSelectedShortcutId && order.length > 0) {
      const a = order.indexOf(lastSelectedShortcutId)
      const b = order.indexOf(id)
      if (a >= 0 && b >= 0) {
        const [start, end] = a < b ? [a, b] : [b, a]
        const range = order.slice(start, end + 1)
        setShortcutSelection(range, id)
      } else {
        setShortcutSelection([id], id)
      }
      setSelectedItemId(id)
      return
    }

    if (isCtrlOrMeta) {
      if (current.has(id)) current.delete(id)
      else current.add(id)
      setShortcutSelection([...current], id)
      setSelectedItemId(id)
      return
    }

    setShortcutSelection([id], id)
    setSelectedItemId(id)
  }

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
            <SidebarHeaderButton icon={icons.search} tooltipText="搜索" />
            <SidebarHeaderButton icon={icons.crosshair} tooltipText="定位到选中项" />
            <SidebarHeaderButton
              icon={allExpanded ? icons.folder : icons.folderOpen}
              tooltipText={allExpanded ? '折叠所有' : '展开所有'}
              onClick={() => {
                if (allExpanded) {
                  if (isShortcuts) collapseShortcutGroups()
                  else collapseAssetFolders(target)
                  return
                }
                if (isShortcuts) expandShortcutGroups()
                else expandAssetFolders(target)
              }}
            />
            <SidebarHeaderButton
              icon={hideEmptyFolders ? FolderEyeOffIcon : FolderEyeIcon}
              tooltipText={hideEmptyFolders ? '显示空文件夹' : '隐藏空文件夹'}
              disabled={disableHideEmptyFolders}
              onClick={() => updateSetting('hideEmptyFolders', !hideEmptyFolders)}
              className={hideEmptyFolders && !disableHideEmptyFolders ? 'bg-border text-text-1' : ''}
            />
            {isShortcuts ? (
              <SidebarHeaderButton icon={icons.link} tooltipText="创建快捷命令" onClick={() => openShortcutDialog('create')} />
            ) : (
              <NewAssetDropdown />
            )}
          </div>
        </div>

        {/* 树形视图 */}
        <div
          id="sidebar-tree"
          className={`flex-1 overflow-y-auto py-1.5 px-1 custom-scrollbar relative ${
            isShortcuts && isShortcutDragging && shortcutDropTarget === 'root'
              ? 'ring-2 ring-primary/40 ring-inset bg-primary/5'
              : ''
          }`}
          onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-blank-shortcut' : 'sidebar-blank-asset')}
          onDragEnter={(e) => {
            if (isShortcuts) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              hydrateShortcutDragState()
              if (shortcutDropTarget !== 'root') setShortcutDropTarget('root')
              return
            }
            e.preventDefault()
            e.currentTarget.classList.add('ring-2', 'ring-primary/30', 'ring-inset')
          }}
          onDragOver={(e) => {
            if (isShortcuts) {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              hydrateShortcutDragState()
              if (shortcutDropTarget !== 'root') setShortcutDropTarget('root')
              return
            }
            e.preventDefault()
            e.currentTarget.classList.add('ring-2', 'ring-primary/30', 'ring-inset')
          }}
          onDragLeave={(e) => {
            if (isShortcuts) {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setShortcutDropTarget(null)
              }
              return
            }
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              e.currentTarget.classList.remove('ring-2', 'ring-primary/30', 'ring-inset')
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('ring-2', 'ring-primary/30', 'ring-inset')
            if (isShortcuts) {
              commitShortcutDrop(e, '')
              return
            }
            const connectionId = parseDraggedConnectionId(e)
            if (connectionId) moveConnectionToFolder(connectionId, null)
          }}
        >
          {isShortcuts && isShortcutDragging && (
            <div
              className={`mx-1 mb-1 rounded-md border border-dashed px-2 py-1.5 text-[11px] transition-colors ${
                shortcutDropTarget === 'root'
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-text-3'
              } pointer-events-none`}
            >
              拖到此处可移到根目录
            </div>
          )}
          {filteredData.map(item => (
            <div key={item.id} className="flex flex-col">
              {item.type === 'folder' ? (
                <>
                  {/* 文件夹项 */}
                  <div
                    className={`flex items-center px-1 py-1.5 rounded-md hover:bg-bg-hover cursor-pointer transition-colors
                      ${selectedItemId === item.id ? 'bg-primary/10 text-primary' : ''}
                      ${isShortcuts && isShortcutDragging && shortcutDropTarget === `group:${item.id}` ? 'ring-2 ring-primary/50 bg-primary/10' : ''}`}
                    onClick={() => {
                      setSelectedItemId(item.id)
                      if (isShortcuts) clearShortcutSelection()
                      if (currentFolder !== item.id) {
                        setCurrentFolder(item.id)
                      }
                    }}
                    onDoubleClick={() => {
                      if (isShortcuts) toggleShortcutGroup(item.id)
                      else toggleAssetFolder(target, item.id)
                    }}
                    onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', item)}
                    onDragEnter={(e) => {
                      if (!isShortcuts) return
                      e.preventDefault()
                      e.stopPropagation()
                      e.dataTransfer.dropEffect = 'move'
                      hydrateShortcutDragState()
                      const target = `group:${item.id}`
                      if (shortcutDropTarget !== target) setShortcutDropTarget(target)
                    }}
                    onDragOver={(e) => {
                      if (isShortcuts) {
                        e.preventDefault()
                        e.stopPropagation()
                        e.dataTransfer.dropEffect = 'move'
                        hydrateShortcutDragState()
                        const target = `group:${item.id}`
                        if (shortcutDropTarget !== target) setShortcutDropTarget(target)
                        return
                      }
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.add('ring-2', 'ring-primary/50')
                    }}
                    onDragLeave={(e) => {
                      if (isShortcuts) {
                        if (!e.currentTarget.contains(e.relatedTarget as Node) && shortcutDropTarget === `group:${item.id}`) {
                          setShortcutDropTarget(null)
                        }
                        return
                      }
                      e.currentTarget.classList.remove('ring-2', 'ring-primary/50')
                    }}
                    onDrop={(e) => {
                      if (isShortcuts) {
                        e.stopPropagation()
                        const groupName = item.groupName ?? item.name
                        commitShortcutDrop(e, groupName)
                        return
                      }
                      e.preventDefault()
                      e.stopPropagation()
                      e.currentTarget.classList.remove('ring-2', 'ring-primary/50')
                      const connectionId = parseDraggedConnectionId(e)
                      if (connectionId) {
                        moveConnectionToFolder(connectionId, item.id)
                      }
                    }}
                  >
                    <span
                      className="w-4 flex justify-center text-text-3 cursor-pointer hover:text-text-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isShortcuts) toggleShortcutGroup(item.id)
                        else toggleAssetFolder(target, item.id)
                      }}
                    >
                      {item.isOpen
                        ? <AppIcon icon={icons.chevronDown} size={14} />
                        : <AppIcon icon={icons.chevronRight} size={14} />}
                    </span>
                    <span className="w-5 flex justify-center mr-1">
                      <AppIcon icon={item.isOpen ? icons.folderOpenFill : icons.folderFill} size={15} className="text-icon-folder" />
                    </span>
                    <span className="text-[12px] text-text-2 truncate flex-1">{item.name}</span>
                  </div>

                  {item.isOpen && item.children?.filter(matchesFilter).map(child => (
                    <div
                      key={child.id}
                      className={`flex items-center px-1 py-1.5 pl-[36px] rounded-md hover:bg-bg-hover cursor-pointer transition-colors
                        ${(isShortcuts ? selectedShortcutIdSet.has(child.id) : selectedItemId === child.id) ? 'bg-primary/10 text-primary' : ''}
                        ${isShortcuts && draggingShortcutIdSet.has(child.id) ? 'opacity-60' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        if (isShortcuts) {
                          const ids = selectedShortcutIdSet.has(child.id) && selectedShortcutIds.length > 1
                            ? selectedShortcutIds
                            : [child.id]
                          draggingShortcutIdsRef.current = ids
                          e.dataTransfer.setData('application/x-vortix-shortcut-ids', JSON.stringify(ids))
                          e.dataTransfer.setData('text/connection-id', ids[0] ?? child.id)
                          e.dataTransfer.setData('text/plain', ids[0] ?? child.id)
                          e.dataTransfer.effectAllowed = 'move'
                          return
                        }
                        e.dataTransfer.setData('text/connection-id', child.id)
                        e.dataTransfer.setData('text/plain', child.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragEnter={(e) => {
                        if (!isShortcuts) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        hydrateShortcutDragState()
                        if (shortcutDropTarget !== 'root') setShortcutDropTarget('root')
                      }}
                      onDragOver={(e) => {
                        if (!isShortcuts) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        hydrateShortcutDragState()
                        if (shortcutDropTarget !== 'root') setShortcutDropTarget('root')
                      }}
                      onClick={(e) => {
                        if (isShortcuts) {
                          handleShortcutClick(e, child.id)
                          return
                        }
                        setSelectedItemId(child.id)
                      }}
                      onDragEnd={() => {
                        if (isShortcuts) resetShortcutDragState()
                      }}
                      onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', child)}
                      onDoubleClick={() => {
                        if (isShortcuts && child.command) {
                          executeShortcut(child.command, 'execute')
                        } else if (child.type === 'connection') {
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
                        <ProtocolIcon protocol={child.protocol} size={15} />
                      </span>
                      <span className={`text-[12px] truncate flex-1 ${getColorTagTextClass(child.colorTag) || 'text-text-2'}`}>{child.name}</span>
                    </div>
                  ))}
                </>
              ) : (
                /* 顶层连接项（无文件夹的 SSH 资产） */
                <div
                  className={`flex items-center px-1 py-1.5 rounded-md hover:bg-bg-hover cursor-pointer transition-colors
                    ${(isShortcuts ? selectedShortcutIdSet.has(item.id) : selectedItemId === item.id) ? 'bg-primary/10 text-primary' : ''}
                    ${isShortcuts && draggingShortcutIdSet.has(item.id) ? 'opacity-60' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    if (isShortcuts) {
                      const ids = selectedShortcutIdSet.has(item.id) && selectedShortcutIds.length > 1
                        ? selectedShortcutIds
                        : [item.id]
                      draggingShortcutIdsRef.current = ids
                      e.dataTransfer.setData('application/x-vortix-shortcut-ids', JSON.stringify(ids))
                      e.dataTransfer.setData('text/connection-id', ids[0] ?? item.id)
                      e.dataTransfer.setData('text/plain', ids[0] ?? item.id)
                      e.dataTransfer.effectAllowed = 'move'
                      return
                    }
                    e.dataTransfer.setData('text/connection-id', item.id)
                    e.dataTransfer.setData('text/plain', item.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnter={(e) => {
                    if (!isShortcuts) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    hydrateShortcutDragState()
                    if (shortcutDropTarget !== 'root') setShortcutDropTarget('root')
                  }}
                  onDragOver={(e) => {
                    if (!isShortcuts) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    hydrateShortcutDragState()
                    if (shortcutDropTarget !== 'root') setShortcutDropTarget('root')
                  }}
                  onClick={(e) => {
                    if (isShortcuts) {
                      handleShortcutClick(e, item.id)
                      return
                    }
                    setSelectedItemId(item.id)
                  }}
                  onDragEnd={() => {
                    if (isShortcuts) resetShortcutDragState()
                  }}
                  onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', item)}
                  onDoubleClick={() => {
                    if (isShortcuts && item.command) {
                      executeShortcut(item.command, 'execute')
                    } else {
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
                    }
                  }}
                >
                  <span className="w-4 flex justify-center" />
                  <span className="w-5 flex justify-center mr-1">
                    <ProtocolIcon protocol={item.protocol} size={15} />
                  </span>
                  <span className={`text-[12px] truncate flex-1 ${getColorTagTextClass(item.colorTag) || 'text-text-2'}`}>{item.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
