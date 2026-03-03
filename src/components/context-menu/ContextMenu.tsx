import { useEffect, useRef, useState, useCallback } from 'react'
import {
  FolderPlus, Link as LinkIcon, FileX, Edit2, Copy, Scissors,
  Clipboard, RefreshCw, FileDown, FileUp, ChevronRight, ChevronDown,
  Terminal, Network, Monitor, Usb, Package, Database,
  Key, Activity, FilePlus, ExternalLink, Columns, CopyPlus,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import type { LucideIcon } from 'lucide-react'
import type { TableContextData } from '../../types'

/* ---- MenuItem ---- */
function MenuItem({
  icon: Icon,
  label,
  shortcut,
  hasSubmenu,
  disabled,
  children,
}: {
  icon?: LucideIcon
  label: string
  shortcut?: string
  hasSubmenu?: boolean
  disabled?: boolean
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
      className={`group/item relative flex items-center justify-between px-3 h-[34px] mx-1.5 my-[2px] rounded-lg text-[13px] transition-colors select-none
        ${disabled ? 'text-[#C9CDD4] cursor-not-allowed' : 'text-[#1F2329] hover:bg-[#E8F0FF] cursor-pointer'}`}
      onMouseEnter={openSubmenu}
      onMouseLeave={closeSubmenu}
    >
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className={`w-3.5 h-3.5 transition-colors ${disabled ? 'text-[#C9CDD4]' : 'text-[#4E5969] group-hover/item:text-[#4080FF]'}`} />}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {shortcut && <span className={`text-[11px] font-sans ${disabled ? 'text-[#C9CDD4]' : 'text-[#86909C]'}`}>{shortcut}</span>}
        {hasSubmenu && <ChevronRight className={`w-3.5 h-3.5 ${disabled ? 'text-[#C9CDD4]' : 'text-[#86909C]'}`} />}
      </div>

      {hasSubmenu && children && !disabled && showSub && (
        <div
          ref={submenuRef}
          className="absolute glass-context rounded-xl py-1.5 w-max z-[101] pointer-events-auto"
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
  return <div className="h-px bg-[#E5E6EB]/60 mx-1.5 my-1" />
}

/* ---- ActionButton（右键菜单顶部工具栏按钮 + tooltip） ---- */
function ActionButton({ icon: Icon, tooltip, disabled }: { icon: LucideIcon; tooltip: string; disabled: boolean }) {
  return (
    <div className="group/action relative flex items-center">
      <button className={`px-[8px] py-[6px] rounded-md transition-colors ${disabled ? 'text-[#C9CDD4] cursor-not-allowed' : 'hover:bg-[#E8F0FF] hover:text-[#4080FF] text-[#4E5969]'}`}>
        <Icon className="w-3.5 h-3.5" />
      </button>
      {!disabled && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/action:flex items-center justify-center z-[150]">
          <div className="bg-[#2D2D2D] text-white text-[12px] px-2 py-1.5 rounded-md shadow-lg whitespace-nowrap font-medium">
            {tooltip}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-t-[4px] border-t-[#333333] border-x-[4px] border-x-transparent" />
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

function NewConnectionSubmenu() {
  return (
    <>
      {newConnectionItems.map((item) => (
        <MenuItem key={item.label} icon={item.icon} label={item.label} />
      ))}
    </>
  )
}

/* ---- 主组件 ---- */
export default function ContextMenu() {
  const contextMenu = useAppStore((s) => s.contextMenu)
  const hideContextMenu = useAppStore((s) => s.hideContextMenu)
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

  let content: React.ReactNode = null

  // ---- 快捷命令右键菜单 ----
  if (contextMenu.type === 'sidebar-shortcut' || contextMenu.type === 'sidebar-blank-shortcut') {
    content = (
      <>
        <div className="px-4 py-1 text-[12px] text-[#86909C] font-medium">操作</div>
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
    content = (
      <>
        <div className="px-4 py-1 text-[12px] text-[#86909C] font-medium">操作</div>
        <MenuItem icon={FolderPlus} label="新建目录" />
        <MenuItem icon={LinkIcon} label="新建连接" hasSubmenu>
          <div className="px-4 py-1 text-[12px] text-[#86909C] border-b border-[#E5E6EB]/50 mb-1">新建连接</div>
          <NewConnectionSubmenu />
        </MenuItem>
        {contextMenu.type === 'sidebar-asset' && <MenuItem icon={LinkIcon} label="批量打开" />}
        <MenuDivider />
        <MenuItem icon={FileX} label="删除" />
        <MenuItem icon={Edit2} label="重命名" />
        <MenuItem icon={Copy} label="复制" />
        <MenuItem icon={Scissors} label="剪切" />
        <MenuItem icon={Clipboard} label="粘贴" />
        <MenuItem icon={RefreshCw} label="刷新" />
        <MenuDivider />
        <MenuItem icon={FileDown} label="导入" />
        <MenuItem icon={FileUp} label="导出" />
      </>
    )
  }
  // ---- 表格右键菜单 ----
  else if (contextMenu.type === 'table-context') {
    const data = contextMenu.data as TableContextData | null
    const target = data?.targetContext || 'asset'
    const isBlank = target === 'blank'
    const isFolder = target === 'folder'

    content = (
      <>
        <div className="flex items-center justify-between px-3.5 py-[5px] mb-1 border-b border-[#E5E6EB]/50">
          <span className="text-[12px] text-[#86909C] font-medium tracking-wide">操作</span>
          <div className="flex items-center bg-[#F2F3F5] rounded border border-[#E5E6EB] p-[2px]">
            <ActionButton icon={Clipboard} tooltip="粘贴(Ctrl+V)" disabled={false} />
            <div className="w-px h-3.5 bg-[#E5E6EB] mx-[1px]" />
            <ActionButton icon={Scissors} tooltip="剪切(Ctrl+X)" disabled={isBlank} />
            <div className="w-px h-3.5 bg-[#E5E6EB] mx-[1px]" />
            <ActionButton icon={Copy} tooltip="复制(Ctrl+C)" disabled={isBlank} />
          </div>
        </div>
        <MenuItem icon={LinkIcon} label="打开" shortcut="Enter" disabled={isBlank} />
        <MenuItem icon={CopyPlus} label="批量打开" disabled={isBlank} />
        <MenuItem icon={RefreshCw} label="刷新" shortcut="F5" />
        <MenuItem icon={FilePlus} label="新标签打开" shortcut="Alt+N" disabled={isBlank || isFolder} />
        <MenuItem icon={ExternalLink} label="新窗口打开" shortcut="Ctrl+Shift+N" disabled={isBlank || isFolder} />
        <MenuItem icon={Columns} label="同屏打开" disabled={isBlank || isFolder} />
        <MenuDivider />
        <MenuItem icon={Copy} label="克隆" disabled={isBlank || isFolder} />
        <MenuItem icon={FolderPlus} label="新建目录" />
        <MenuItem icon={Edit2} label="编辑" disabled={isBlank || isFolder} />
        <MenuItem icon={CopyPlus} label="批量编辑" disabled={isBlank || isFolder} />
        <MenuItem icon={FileX} label="删除" shortcut="Backspace" disabled={isBlank} />
        <MenuItem icon={Edit2} label="重命名" shortcut="F2" disabled={isBlank} />
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

  if (!content) return null

  return (
    <div
      ref={menuRef}
      className="fixed glass-context rounded-xl py-1.5 min-w-[210px] z-[100]"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </div>
  )
}
