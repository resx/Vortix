import { useEffect, useRef, useState, useCallback } from 'react'
import {
  FolderPlus, Link as LinkIcon, FileX, Edit2, Copy, Scissors,
  Clipboard, RefreshCw, FileDown, FileUp, ChevronRight, ChevronDown,
  Terminal, Network, Monitor, Usb, Package, Database,
  Key, Activity, FilePlus, ExternalLink, Columns, CopyPlus,
  ClipboardType, Search, SquareArrowOutUpRight, Trash2, SquareX,
  FileEdit, SplitSquareVertical, SplitSquareHorizontal,
  Clock, Save, TerminalSquare, AppWindow,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useWorkspaceStore, collectLeafIds } from '../../stores/useWorkspaceStore'
import type { LucideIcon } from 'lucide-react'
import type { TableContextData, TerminalContextData } from '../../types'

/* ---- MenuItem ---- */
function MenuItem({
  icon: Icon,
  label,
  shortcut,
  hasSubmenu,
  disabled,
  onClick,
  children,
}: {
  icon?: LucideIcon
  label: string
  shortcut?: string
  hasSubmenu?: boolean
  disabled?: boolean
  onClick?: () => void
  children?: React.ReactNode
}) {
  const itemRef = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [showSub, setShowSub] = useState(false)
  const [subPos, setSubPos] = useState<{ top?: string; bottom?: string; left?: string; right?: string }>({})
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const openSubmenu = useCallback(() => {
    if (disabled || !hasSubmenu) return
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setShowSub(true)
  }, [disabled, hasSubmenu])

  const closeSubmenu = useCallback(() => {
    hideTimer.current = setTimeout(() => setShowSub(false), 150)
  }, [])

  useEffect(() => {
    if (!showSub || !itemRef.current || !submenuRef.current) return
    const parentRect = itemRef.current.getBoundingClientRect()
    const subRect = submenuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 4

    const pos: typeof subPos = {}

    if (parentRect.right + subRect.width + gap > vw) {
      pos.right = `calc(100% + ${gap}px)`
      pos.left = undefined
    } else {
      pos.left = `calc(100% + ${gap}px)`
      pos.right = undefined
    }

    const idealTop = parentRect.top - 6
    if (idealTop + subRect.height > vh) {
      const idealBottom = vh - parentRect.bottom - 6
      if (idealBottom >= 0 && parentRect.bottom - subRect.height + 6 >= 0) {
        pos.bottom = '-6px'
        pos.top = undefined
      } else {
        pos.top = `${vh - parentRect.top - subRect.height}px`
        pos.bottom = undefined
      }
    } else {
      pos.top = '-6px'
      pos.bottom = undefined
    }

    setSubPos(pos)
  }, [showSub])

  return (
    <div
      ref={itemRef}
      className={`group/item relative flex items-center justify-between px-2.5 h-[28px] mx-1 my-[2px] rounded-md text-[12px] transition-colors select-none
        ${disabled ? 'text-text-disabled cursor-not-allowed' : 'text-text-1 hover:bg-bg-active cursor-pointer'}`}
      onMouseEnter={openSubmenu}
      onMouseLeave={closeSubmenu}
      onClick={() => { if (!disabled && !hasSubmenu && onClick) onClick() }}
    >
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className={`w-3 h-3 transition-colors ${disabled ? 'text-text-disabled' : 'text-text-2 group-hover/item:text-primary'}`} />}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {shortcut && <span className={`text-[10px] font-sans ${disabled ? 'text-text-disabled' : 'text-text-3'}`}>{shortcut}</span>}
        {hasSubmenu && <ChevronRight className={`w-3 h-3 ${disabled ? 'text-text-disabled' : 'text-text-3'}`} />}
      </div>

      {hasSubmenu && children && !disabled && showSub && (
        <div
          ref={submenuRef}
          className="absolute glass-context rounded-xl py-1 w-max z-[101] pointer-events-auto"
          style={subPos}
          onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current) }}
          onMouseLeave={closeSubmenu}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function MenuDivider() {
  return <div className="h-px bg-border/60 mx-1.5 my-0.5" />
}

/* ---- ActionButton（右键菜单顶部工具栏按钮 + tooltip） ---- */
function ActionButton({ icon: Icon, tooltip, disabled }: { icon: LucideIcon; tooltip: string; disabled: boolean }) {
  return (
    <div className="group/action relative flex items-center">
      <button className={`px-[6px] py-[4px] rounded-md transition-colors ${disabled ? 'text-text-disabled cursor-not-allowed' : 'hover:bg-bg-active hover:text-primary text-text-2'}`}>
        <Icon className="w-3 h-3" />
      </button>
      {!disabled && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/action:flex items-center justify-center z-[150]">
          <div className="bg-tooltip-bg text-tooltip-text text-[11px] px-2 py-1.5 rounded-md shadow-lg whitespace-nowrap font-medium">
            {tooltip}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-t-[4px] border-t-tooltip-bg border-x-[4px] border-x-transparent" />
        </div>
      )}
    </div>
  )
}

/* ---- 新建连接子菜单 ---- */
const newConnectionItems: { icon: LucideIcon; label: string }[] = [
  { icon: Terminal, label: '本地终端' },
  { icon: Terminal, label: 'SSH' },
  { icon: Network, label: 'SSH隧道' },
  { icon: Monitor, label: 'Telnet' },
  { icon: Usb, label: '串口' },
  { icon: Monitor, label: 'RDP' },
  { icon: Package, label: 'Docker' },
  { icon: Database, label: 'Redis' },
  { icon: Database, label: 'MySQL' },
  { icon: Database, label: 'MariaDB' },
  { icon: Database, label: 'PostgreSQL' },
  { icon: Database, label: 'SqlServer' },
  { icon: Database, label: 'ClickHouse' },
  { icon: Database, label: 'SQLite' },
  { icon: Database, label: 'Oracle' },
  { icon: Database, label: '达梦' },
]

function NewConnectionSubmenu({ onSelectSsh }: { onSelectSsh: () => void }) {
  return (
    <>
      {newConnectionItems.map((item) => (
        <MenuItem
          key={item.label}
          icon={item.icon}
          label={item.label}
          onClick={item.label === 'SSH' ? onSelectSsh : undefined}
        />
      ))}
    </>
  )
}

/* ---- 主组件 ---- */
export default function ContextMenu() {
  const contextMenu = useAppStore((s) => s.contextMenu)
  const hideContextMenu = useAppStore((s) => s.hideContextMenu)
  const setShowDirModal = useAppStore((s) => s.setShowDirModal)
  const openSshConfig = useAppStore((s) => s.openSshConfig)
  const openAssetTab = useAppStore((s) => s.openAssetTab)
  const fetchAssets = useAppStore((s) => s.fetchAssets)
  const deleteFolderAction = useAppStore((s) => s.deleteFolderAction)
  const deleteConnectionAction = useAppStore((s) => s.deleteConnectionAction)
  const renameFolderAction = useAppStore((s) => s.renameFolderAction)
  const renameConnectionAction = useAppStore((s) => s.renameConnectionAction)
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const adjustPosition = useCallback(() => {
    if (!menuRef.current || !contextMenu.visible) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 4

    let left = contextMenu.x
    if (left + rect.width > vw - pad) left = vw - rect.width - pad
    if (left < pad) left = pad

    let top = contextMenu.y
    if (top + rect.height > vh - pad) top = vh - rect.height - pad
    if (top < pad) top = pad

    setPosition({ top, left })
  }, [contextMenu.visible, contextMenu.x, contextMenu.y])

  useEffect(() => {
    if (contextMenu.visible) {
      setPosition({ top: contextMenu.y, left: contextMenu.x })
      requestAnimationFrame(adjustPosition)
    }
  }, [contextMenu.visible, contextMenu.x, contextMenu.y, adjustPosition])

  useEffect(() => {
    const close = () => hideContextMenu()
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [hideContextMenu])

  if (!contextMenu.visible || !contextMenu.type) return null

  // 辅助操作
  const handleDelete = (id: string, type: 'folder' | 'connection' | 'asset') => {
    hideContextMenu()
    if (!confirm(`确定要删除吗？此操作不可撤销。`)) return
    if (type === 'folder') {
      deleteFolderAction(id)
    } else {
      deleteConnectionAction(id)
    }
  }

  const handleRename = (id: string, type: 'folder' | 'connection' | 'asset', currentName: string) => {
    hideContextMenu()
    const newName = prompt('请输入新名称', currentName)
    if (!newName || newName === currentName) return
    if (type === 'folder') {
      renameFolderAction(id, newName)
    } else {
      renameConnectionAction(id, newName)
    }
  }

  let content: React.ReactNode = null

  // ---- 快捷命令右键菜单 ----
  if (contextMenu.type === 'sidebar-shortcut' || contextMenu.type === 'sidebar-blank-shortcut') {
    content = (
      <>
        <div className="px-4 py-1 text-[11px] text-text-1 font-medium">操作</div>
        <MenuItem icon={FolderPlus} label="新建分组" />
        <MenuItem icon={LinkIcon} label="新建快捷命令" />
        <MenuDivider />
        <MenuItem icon={FileX} label="删除" />
        <MenuItem icon={Edit2} label="重命名" />
        <MenuItem icon={RefreshCw} label="刷新" />
        <MenuDivider />
        <MenuItem icon={FileDown} label="导入" />
        <MenuItem icon={FileUp} label="导出" />
        <MenuItem icon={FileUp} label="导出全部" />
      </>
    )
  }
  // ---- 资产侧边栏右键菜单 ----
  else if (contextMenu.type === 'sidebar-asset' || contextMenu.type === 'sidebar-blank-asset') {
    const item = contextMenu.data as import('../../types').TreeItem | null
    const isItem = contextMenu.type === 'sidebar-asset' && item

    content = (
      <>
        <div className="px-4 py-1 text-[11px] text-text-1 font-medium">操作</div>
        <MenuItem icon={FolderPlus} label="新建目录" onClick={() => { hideContextMenu(); setShowDirModal(true) }} />
        <MenuItem icon={LinkIcon} label="新建连接" hasSubmenu>
          <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">新建连接</div>
          <NewConnectionSubmenu onSelectSsh={() => { hideContextMenu(); openSshConfig('create') }} />
        </MenuItem>
        {isItem && <MenuItem icon={LinkIcon} label="批量打开" />}
        <MenuDivider />
        <MenuItem icon={FileX} label="删除" disabled={!isItem} onClick={isItem ? () => handleDelete(item!.id, item!.type) : undefined} />
        <MenuItem icon={Edit2} label="重命名" disabled={!isItem} onClick={isItem ? () => handleRename(item!.id, item!.type, item!.name) : undefined} />
        <MenuItem icon={Copy} label="复制" disabled={!isItem} />
        <MenuItem icon={Scissors} label="剪切" disabled={!isItem} />
        <MenuItem icon={Clipboard} label="粘贴" />
        <MenuItem icon={RefreshCw} label="刷新" onClick={() => { hideContextMenu(); fetchAssets() }} />
        <MenuDivider />
        <MenuItem icon={FileDown} label="导入" />
        <MenuItem icon={FileUp} label="导出" disabled={!isItem} />
      </>
    )
  }
  // ---- 表格右键菜单 ----
  else if (contextMenu.type === 'table-context') {
    const data = contextMenu.data as TableContextData | null
    const target = data?.targetContext || 'asset'
    const isBlank = target === 'blank'
    const isFolder = target === 'folder'
    const rowData = data?.rowData

    content = (
      <>
        <div className="flex items-center justify-between px-3 py-[4px] mb-1 border-b border-border/50">
          <span className="text-[11px] text-text-1 font-medium tracking-wide">操作</span>
          <div className="flex items-center bg-bg-base rounded border border-border p-[2px]">
            <ActionButton icon={Clipboard} tooltip="粘贴(Ctrl+V)" disabled={false} />
            <div className="w-px h-3 bg-border mx-[1px]" />
            <ActionButton icon={Scissors} tooltip="剪切(Ctrl+X)" disabled={isBlank} />
            <div className="w-px h-3 bg-border mx-[1px]" />
            <ActionButton icon={Copy} tooltip="复制(Ctrl+C)" disabled={isBlank} />
          </div>
        </div>
        <MenuItem icon={LinkIcon} label="打开" shortcut="Enter" disabled={isBlank} onClick={rowData && !isBlank ? () => { hideContextMenu(); openAssetTab(rowData) } : undefined} />
        <MenuItem icon={CopyPlus} label="批量打开" disabled={isBlank} />
        <MenuItem icon={RefreshCw} label="刷新" shortcut="F5" onClick={() => { hideContextMenu(); fetchAssets() }} />
        <MenuItem icon={FilePlus} label="新标签打开" shortcut="Alt+N" disabled={isBlank || isFolder} />
        <MenuItem icon={ExternalLink} label="新窗口打开" shortcut="Ctrl+Shift+N" disabled={isBlank || isFolder} />
        <MenuItem icon={Columns} label="同屏打开" disabled={isBlank || isFolder} />
        <MenuDivider />
        <MenuItem icon={Copy} label="克隆" disabled={isBlank || isFolder} />
        <MenuItem icon={FolderPlus} label="新建目录" onClick={() => { hideContextMenu(); setShowDirModal(true) }} />
        <MenuItem icon={LinkIcon} label="新建连接" hasSubmenu>
          <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">新建连接</div>
          <NewConnectionSubmenu onSelectSsh={() => { hideContextMenu(); openSshConfig('create') }} />
        </MenuItem>
        <MenuItem icon={Edit2} label="编辑" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { hideContextMenu(); openSshConfig('edit', rowData.id) } : undefined} />
        <MenuItem icon={CopyPlus} label="批量编辑" disabled={isBlank || isFolder} />
        <MenuItem icon={FileX} label="删除" shortcut="Backspace" disabled={isBlank} onClick={rowData && !isBlank ? () => handleDelete(rowData.id, rowData.type === 'folder' ? 'folder' : 'asset') : undefined} />
        <MenuItem icon={Edit2} label="重命名" shortcut="F2" disabled={isBlank} onClick={rowData && !isBlank ? () => handleRename(rowData.id, rowData.type === 'folder' ? 'folder' : 'asset', rowData.name) : undefined} />
        <MenuDivider />
        <MenuItem icon={ChevronDown} label="更多" hasSubmenu disabled={isBlank}>
          <MenuItem icon={FileDown} label="通过文本批量导入SSH" />
          <MenuItem icon={Key} label="上传 SSH公钥(ssh-copy-id)" />
          <MenuItem icon={Activity} label="Ping" disabled={isBlank || isFolder} />
          <MenuItem icon={FileDown} label="导入" />
          <MenuItem icon={FileUp} label="导出" />
        </MenuItem>
      </>
    )
  }
  // ---- 终端右键菜单 ----
  else if (contextMenu.type === 'terminal') {
    const data = contextMenu.data as TerminalContextData | null
    const noSelection = !data?.hasSelection
    const termTabId = data?.tabId
    const termPaneId = data?.paneId
    const { splitPane, closePane, workspaces } = useWorkspaceStore.getState()
    const ws = termTabId ? workspaces[termTabId] : null
    const paneCount = ws ? collectLeafIds(ws.rootNode).length : 1

    const handleSplit = (dir: 'vertical' | 'horizontal') => {
      if (termTabId && termPaneId) {
        splitPane(termTabId, termPaneId, dir)
      }
      hideContextMenu()
    }
    const handleClosePane = () => {
      if (termTabId && termPaneId) {
        closePane(termTabId, termPaneId)
      }
      hideContextMenu()
    }

    content = (
      <>
        <div className="px-4 py-1 text-[11px] text-text-1 font-medium">操作</div>
        <MenuItem icon={Copy} label="复制" shortcut="Ctrl+Shift+C" disabled={noSelection} />
        <MenuItem icon={Clipboard} label="粘贴" shortcut="Ctrl+Shift+V" />
        <MenuItem icon={ClipboardType} label="粘贴选中文本" disabled={noSelection} />
        <MenuItem icon={Search} label="搜索" hasSubmenu>
          <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">搜索引擎</div>
          <MenuItem icon={Search} label="Google" />
          <MenuItem icon={Search} label="Bing" />
          <MenuItem icon={Search} label="百度" />
        </MenuItem>
        <MenuItem icon={AppWindow} label="通过服务器代理 Chrome" />
        <MenuDivider />
        <MenuItem icon={SquareArrowOutUpRight} label="新终端窗口" shortcut="Ctrl+Shift+N" />
        <MenuItem icon={RefreshCw} label="重新连接" shortcut="Ctrl+Shift+R" />
        <MenuItem icon={Trash2} label="清屏" shortcut="Ctrl+Shift+L" />
        <MenuItem icon={SquareX} label="断开连接" shortcut="Ctrl+W" />
        <MenuItem icon={FileEdit} label="唤起输入框输入" shortcut="Ctrl+I" />
        <MenuDivider />
        <MenuItem icon={SplitSquareVertical} label="垂直分屏" shortcut="Ctrl+Shift+=" onClick={() => handleSplit('vertical')} />
        <MenuItem icon={SplitSquareHorizontal} label="水平分屏" shortcut="Ctrl+Shift+-" onClick={() => handleSplit('horizontal')} />
        <MenuItem icon={SquareX} label="关闭面板" disabled={paneCount <= 1} onClick={handleClosePane} />
        <MenuDivider />
        <MenuItem icon={ChevronDown} label="更多" hasSubmenu>
          <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">更多</div>
          <MenuItem icon={Clock} label="开始记录日志" />
          <MenuItem icon={Save} label="保存为日志" />
          <MenuItem icon={TerminalSquare} label="批量执行命令" />
          <MenuItem icon={FileDown} label="SCP 下载" shortcut="Ctrl+Shift+D" />
          <MenuItem icon={FileUp} label="SCP 上传" shortcut="Ctrl+Shift+U" />
        </MenuItem>
      </>
    )
  }

  if (!content) return null

  const menuWidth = contextMenu.type === 'terminal' ? 'min-w-[260px]' : 'min-w-[210px]'

  return (
    <div
      ref={menuRef}
      className={`fixed glass-context rounded-xl py-1 ${menuWidth} z-[100]`}
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </div>
  )
}
