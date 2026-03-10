import { useEffect, useRef, useState, useCallback } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { ProtocolIcon, DB_LABEL_PROTOCOL } from '../icons/ProtocolIcons'
import { useAssetStore } from '../../stores/useAssetStore'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { useToastStore } from '../../stores/useToastStore'
import { useWorkspaceStore, collectLeafIds } from '../../stores/useWorkspaceStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { getSession } from '../../stores/terminalSessionRegistry'
import type { TableContextData, TerminalContextData, TabContextData } from '../../types'
import * as api from '../../api/client'

/* ---- MenuItem ---- */
function MenuItem({
  icon,
  iconNode,
  label,
  shortcut,
  hasSubmenu,
  disabled,
  onClick,
  children,
}: {
  icon?: string
  iconNode?: React.ReactNode
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
        {iconNode ? <span className="transition-colors">{iconNode}</span> : icon ? <AppIcon icon={icon} size={12} className={`transition-colors ${disabled ? 'text-text-disabled' : 'text-text-2 group-hover/item:text-primary'}`} /> : null}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {shortcut && <span className={`text-[10px] font-sans ${disabled ? 'text-text-disabled' : 'text-text-3'}`}>{shortcut}</span>}
        {hasSubmenu && <AppIcon icon={icons.chevronRight} size={12} className={disabled ? 'text-text-disabled' : 'text-text-3'} />}
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
function ActionButton({ icon, tooltip, disabled, onClick }: { icon: string; tooltip: string; disabled: boolean; onClick?: () => void }) {
  return (
    <div className="group/action relative flex items-center">
      <button onClick={!disabled ? onClick : undefined} className={`px-[6px] py-[4px] rounded-md transition-colors ${disabled ? 'text-text-disabled cursor-not-allowed' : 'hover:bg-bg-active hover:text-primary text-text-2'}`}>
        <AppIcon icon={icon} size={12} />
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
const newConnectionItems: { icon?: string; protocol?: string; label: string }[] = [
  { protocol: 'local', label: '本地终端' },
  { protocol: 'ssh', label: 'SSH' },
  { icon: icons.network, label: 'SSH隧道' },
  { icon: icons.monitor, label: 'Telnet' },
  { icon: icons.usb, label: '串口' },
  { protocol: 'rdp', label: 'RDP' },
  { protocol: 'docker', label: 'Docker' },
  { protocol: 'redis', label: 'Redis' },
  { protocol: 'mysql', label: 'MySQL' },
  { protocol: 'mariadb', label: 'MariaDB' },
  { protocol: 'postgresql', label: 'PostgreSQL' },
  { protocol: 'sqlserver', label: 'SqlServer' },
  { protocol: 'clickhouse', label: 'ClickHouse' },
  { protocol: 'sqlite', label: 'SQLite' },
  { protocol: 'oracle', label: 'Oracle' },
  { protocol: 'dameng', label: '达梦' },
]

function NewConnectionSubmenu({ onSelectSsh, onSelectLocalTerm }: { onSelectSsh: () => void; onSelectLocalTerm: () => void }) {
  return (
    <>
      {newConnectionItems.map((item) => (
        <MenuItem
          key={item.label}
          iconNode={item.protocol
            ? <ProtocolIcon protocol={item.protocol} size={12} mono className="text-text-1" />
            : <AppIcon icon={item.icon!} size={12} className="text-text-1" />}
          label={item.label}
          onClick={item.label === 'SSH' ? onSelectSsh : item.label === '本地终端' ? onSelectLocalTerm : undefined}
        />
      ))}
    </>
  )
}

/* ---- 文件导入导出辅助 ---- */
function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { reject(new Error('cancelled')); return }
      const reader = new FileReader()
      reader.onload = () => {
        try { resolve(JSON.parse(reader.result as string)) }
        catch { reject(new Error('invalid json')) }
      }
      reader.readAsText(file)
    }
    input.click()
  })
}

/* ---- 连接剪贴板（模块级状态） ---- */
let connClipboard: { ids: string[]; op: 'copy' | 'cut' } | null = null

/* ---- 终端日志记录状态 ---- */
const recordingPanes = new Map<string, number>()

/* ---- 主组件 ---- */
export default function ContextMenu() {
  const contextMenu = useUIStore((s) => s.contextMenu)
  const hideContextMenu = useUIStore((s) => s.hideContextMenu)
  const setShowDirModal = useUIStore((s) => s.setShowDirModal)
  const openSshConfig = useUIStore((s) => s.openSshConfig)
  const openLocalTermConfig = useUIStore((s) => s.openLocalTermConfig)
  const openAssetTab = useTabStore((s) => s.openAssetTab)
  const fetchAssets = useAssetStore((s) => s.fetchAssets)
  const deleteFolderAction = useAssetStore((s) => s.deleteFolderAction)
  const deleteConnectionAction = useAssetStore((s) => s.deleteConnectionAction)
  const renameFolderAction = useAssetStore((s) => s.renameFolderAction)
  const renameConnectionAction = useAssetStore((s) => s.renameConnectionAction)
  const cloneConnectionAction = useAssetStore((s) => s.cloneConnectionAction)
  const tabs = useTabStore((s) => s.tabs)
  const tableData = useAssetStore((s) => s.tableData)
  const closeTab = useTabStore((s) => s.closeTab)
  const closeOtherTabs = useTabStore((s) => s.closeOtherTabs)
  const closeAllTabs = useTabStore((s) => s.closeAllTabs)
  const closeLeftTabs = useTabStore((s) => s.closeLeftTabs)
  const closeRightTabs = useTabStore((s) => s.closeRightTabs)
  const renameTab = useTabStore((s) => s.renameTab)
  const duplicateTab = useTabStore((s) => s.duplicateTab)
  const reconnectTab = useTabStore((s) => s.reconnectTab)
  const openShortcutDialog = useShortcutStore((s) => s.openShortcutDialog)
  const deleteShortcutAction = useShortcutStore((s) => s.deleteShortcutAction)
  const executeShortcut = useShortcutStore((s) => s.executeShortcut)
  const batchOpenSelected = useAssetStore((s) => s.batchOpenSelected)
  const openSplitTab = useTabStore((s) => s.openSplitTab)
  const fetchShortcuts = useShortcutStore((s) => s.fetchShortcuts)
  const addToast = useToastStore((s) => s.addToast)
  const assets = useAssetStore((s) => s.assets)
  const selectedRowIds = useAssetStore((s) => s.selectedRowIds)
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
    const item = contextMenu.data as import('../../types').TreeItem | null
    const isItem = contextMenu.type === 'sidebar-shortcut' && item
    const hasCommand = isItem && !!item!.command

    content = (
      <>
        <div className="px-4 py-1 text-[11px] text-text-1 font-medium">操作</div>
        <MenuItem icon={icons.link} label="新建快捷命令" onClick={() => { hideContextMenu(); openShortcutDialog('create') }} />
        <MenuItem icon={icons.folderPlus} label="新建分组" />
        <MenuDivider />
        <MenuItem icon={icons.terminal} label="执行" disabled={!hasCommand} onClick={hasCommand ? () => { hideContextMenu(); executeShortcut(item!.command!, 'execute') } : undefined} />
        <MenuItem icon={icons.clipboard} label="粘贴到终端" disabled={!hasCommand} onClick={hasCommand ? () => { hideContextMenu(); executeShortcut(item!.command!, 'paste') } : undefined} />
        <MenuDivider />
        <MenuItem icon={icons.edit} label="编辑" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); openShortcutDialog('edit', item!.id) } : undefined} />
        <MenuItem icon={icons.fileX} label="删除" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); if (confirm('确定要删除此快捷命令？')) deleteShortcutAction(item!.id) } : undefined} />
        <MenuDivider />
        <MenuItem icon={icons.fileDown} label="导入" onClick={() => { hideContextMenu(); pickJsonFile().then(async (data) => { const items = (Array.isArray(data) ? data : [data]) as { name?: string; command?: string; remark?: string }[]; let count = 0; for (const it of items) { if (it.name && it.command) { await api.createShortcut({ name: it.name, command: it.command, remark: it.remark }); count++ } } fetchShortcuts(); addToast('success', `成功导入 ${count} 条快捷命令`) }).catch(() => {}) }} />
        <MenuItem icon={icons.fileUp} label="导出" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); downloadJson([{ name: item!.name, command: item!.command, remark: item!.remark }], `shortcut-${item!.name}.json`) } : undefined} />
        <MenuItem icon={icons.fileUp} label="导出全部" onClick={() => { hideContextMenu(); api.getShortcuts().then(data => { downloadJson(data.map(s => ({ name: s.name, command: s.command, remark: s.remark })), 'vortix-shortcuts.json') }) }} />
      </>
    )
  }
  // ---- 资产侧边栏右键菜单 ----
  else if (contextMenu.type === 'sidebar-asset' || contextMenu.type === 'sidebar-blank-asset') {
    const item = contextMenu.data as import('../../types').TreeItem | null
    const isItem = contextMenu.type === 'sidebar-asset' && item
    const isConnection = isItem && item!.type === 'connection'
    const isFolder = isItem && item!.type === 'folder'
    const isLocal = isConnection && item!.protocol === 'local'

    // 查找该连接是否已打开标签页
    const connTab = isConnection ? tabs.find(t => t.connectionId === item!.id) : null
    const hasOpenTab = !!connTab
    // 查找 AssetRow 用于打开标签页
    const assetRow = isConnection ? tableData.find(r => r.id === item!.id) : null

    // 通用菜单项
    const newDirItem = <MenuItem icon={icons.folderPlus} label="新建目录" onClick={() => { hideContextMenu(); setShowDirModal(true) }} />
    const newConnItem = (
      <MenuItem icon={icons.link} label="新建连接" hasSubmenu>
        <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">新建连接</div>
        <NewConnectionSubmenu onSelectSsh={() => { hideContextMenu(); openSshConfig('create') }} onSelectLocalTerm={() => { hideContextMenu(); openLocalTermConfig('create') }} />
      </MenuItem>
    )
    const refreshItem = <MenuItem icon={icons.refresh} label="刷新" onClick={() => { hideContextMenu(); fetchAssets() }} />

    if (isLocal) {
      // ── 本地终端右键菜单 ──
      content = (
        <>
          <div className="px-4 py-1 text-[11px] text-text-1 font-medium">本地终端</div>
          <MenuItem icon={icons.squareX} label="关闭" disabled={!hasOpenTab} onClick={hasOpenTab ? () => { hideContextMenu(); closeTab(connTab!.id) } : undefined} />
          {newDirItem}
          {newConnItem}
          <MenuItem icon={icons.filePlus} label="新标签页打开" onClick={assetRow ? () => { hideContextMenu(); openAssetTab(assetRow) } : undefined} />
          <MenuDivider />
          <MenuItem icon={icons.edit} label="编辑" onClick={() => { hideContextMenu(); openLocalTermConfig('edit', item!.id) }} />
          <MenuItem icon={icons.copyPlus} label="克隆" onClick={() => { hideContextMenu(); cloneConnectionAction(item!.id) }} />
          <MenuItem icon={icons.fileX} label="删除" onClick={() => handleDelete(item!.id, 'connection')} />
          <MenuItem icon={icons.edit} label="重命名" onClick={() => handleRename(item!.id, 'connection', item!.name)} />
          {refreshItem}
        </>
      )
    } else if (isConnection) {
      // ── SSH / 其他远程连接右键菜单 ──
      content = (
        <>
          <div className="px-4 py-1 text-[11px] text-text-1 font-medium">SSH 连接</div>
          <MenuItem icon={icons.squareX} label="关闭" disabled={!hasOpenTab} onClick={hasOpenTab ? () => { hideContextMenu(); closeTab(connTab!.id) } : undefined} />
          {newDirItem}
          {newConnItem}
          <MenuItem icon={icons.filePlus} label="新标签页打开" onClick={assetRow ? () => { hideContextMenu(); openAssetTab(assetRow) } : undefined} />
          <MenuDivider />
          <MenuItem icon={icons.edit} label="编辑" onClick={() => { hideContextMenu(); openSshConfig('edit', item!.id) }} />
          <MenuItem icon={icons.fileEdit} label="批量编辑" disabled />
          <MenuItem icon={icons.copyPlus} label="克隆" onClick={() => { hideContextMenu(); cloneConnectionAction(item!.id) }} />
          <MenuItem icon={icons.copy} label="复制 Host" onClick={() => { hideContextMenu(); const row = tableData.find(r => r.id === item!.id); if (row?.host) navigator.clipboard.writeText(row.host) }} />
          <MenuItem icon={icons.globe} label="通过服务器代理 Chrome" disabled />
          <MenuItem icon={icons.key} label="上传 SSH 公钥" onClick={() => { hideContextMenu(); api.getSshKeys().then(keys => { if (keys.length === 0) { addToast('error', '请先在密钥库中添加密钥'); return } const names = keys.map((k, i) => `${i + 1}. ${k.name}`).join('\n'); const idx = prompt(`选择要上传的公钥：\n${names}\n\n请输入序号`, '1'); if (!idx) return; const key = keys[parseInt(idx) - 1]; if (!key) { addToast('error', '无效的序号'); return } api.uploadSshKey(item!.id, key.id).then(r => addToast('success', r.message)).catch(e => addToast('error', (e as Error).message)) }) }} />
          <MenuItem icon={icons.fileX} label="删除" onClick={() => handleDelete(item!.id, 'connection')} />
          <MenuItem icon={icons.edit} label="重命名" onClick={() => handleRename(item!.id, 'connection', item!.name)} />
          {refreshItem}
          <MenuDivider />
          <MenuItem icon={icons.fileDown} label="导入" onClick={() => { hideContextMenu(); pickJsonFile().then(async (data: any) => { const conns = Array.isArray(data) ? data : data.connections ?? [data]; let count = 0; for (const c of conns) { if (c.name && c.host) { await api.createConnection({ name: c.name, host: c.host, port: c.port, username: c.username ?? '', protocol: c.protocol, auth_method: c.auth_method, remark: c.remark, color_tag: c.color_tag, folder_id: c.folder_id }); count++ } } fetchAssets(); addToast('success', `成功导入 ${count} 条连接`) }).catch(() => {}) }} />
          <MenuItem icon={icons.fileUp} label="导出" onClick={() => { hideContextMenu(); api.getConnection(item!.id).then(conn => downloadJson({ connections: [conn] }, `connection-${conn.name}.json`)) }} />
        </>
      )
    } else {
      // ── 文件夹 / 空白区域右键菜单 ──
      content = (
        <>
          <div className="px-4 py-1 text-[11px] text-text-1 font-medium">操作</div>
          {newDirItem}
          {newConnItem}
          {isFolder && <MenuItem icon={icons.link} label="批量打开" onClick={() => { hideContextMenu(); const children = item!.children ?? []; children.forEach(c => { if (c.type === 'connection') { const row = tableData.find(r => r.id === c.id); if (row) openAssetTab(row) } }) }} />}
          <MenuDivider />
          <MenuItem icon={icons.fileX} label="删除" disabled={!isFolder} onClick={isFolder ? () => handleDelete(item!.id, 'folder') : undefined} />
          <MenuItem icon={icons.edit} label="重命名" disabled={!isFolder} onClick={isFolder ? () => handleRename(item!.id, 'folder', item!.name) : undefined} />
          <MenuItem icon={icons.copy} label="复制" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); connClipboard = { ids: [item!.id], op: 'copy' }; addToast('success', '已复制') } : undefined} />
          <MenuItem icon={icons.scissors} label="剪切" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); connClipboard = { ids: [item!.id], op: 'cut' }; addToast('success', '已剪切') } : undefined} />
          <MenuItem icon={icons.clipboard} label="粘贴" disabled={!connClipboard} onClick={connClipboard ? () => { hideContextMenu(); const cb = connClipboard!; const targetFolderId = isFolder ? item!.id : null; connClipboard = null; ;(async () => { for (const id of cb.ids) { if (cb.op === 'cut') { await api.updateConnection(id, { folder_id: targetFolderId }) } else { const conn = await api.getConnection(id); await api.createConnection({ name: conn.name + ' (副本)', host: conn.host, port: conn.port, username: conn.username, protocol: conn.protocol, auth_method: conn.auth_method, remark: conn.remark, color_tag: conn.color_tag, folder_id: targetFolderId }) } } fetchAssets(); addToast('success', cb.op === 'cut' ? '已移动' : '已粘贴') })() } : undefined} />
          {refreshItem}
          <MenuDivider />
          <MenuItem icon={icons.fileDown} label="导入" onClick={() => { hideContextMenu(); pickJsonFile().then(async (data: any) => { const conns = Array.isArray(data) ? data : data.connections ?? [data]; let count = 0; for (const c of conns) { if (c.name && c.host) { await api.createConnection({ name: c.name, host: c.host, port: c.port, username: c.username ?? '', protocol: c.protocol, auth_method: c.auth_method, remark: c.remark, color_tag: c.color_tag, folder_id: isFolder ? item!.id : null }); count++ } } fetchAssets(); addToast('success', `成功导入 ${count} 条连接`) }).catch(() => {}) }} />
          <MenuItem icon={icons.fileUp} label="导出" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); if (isFolder) { const children = item!.children ?? []; const connIds = children.filter(c => c.type === 'connection').map(c => c.id); Promise.all(connIds.map(id => api.getConnection(id))).then(conns => downloadJson({ connections: conns }, `folder-${item!.name}.json`)) } else { api.getConnection(item!.id).then(conn => downloadJson({ connections: [conn] }, `connection-${conn.name}.json`)) } } : undefined} />
        </>
      )
    }
  }
  // ---- 表格右键菜单 ----
  else if (contextMenu.type === 'table-context') {
    const data = contextMenu.data as TableContextData | null
    const target = data?.targetContext || 'asset'
    const isBlank = target === 'blank'
    const isFolder = target === 'folder'
    const rowData = data?.rowData
    const currentFolderId = data?.currentFolderId

    content = (
      <>
        <div className="flex items-center justify-between px-3 py-[4px] mb-1 border-b border-border/50">
          <span className="text-[11px] text-text-1 font-medium tracking-wide">操作</span>
          <div className="flex items-center bg-bg-base rounded border border-border p-[2px]">
            <ActionButton icon={icons.clipboard} tooltip="粘贴(Ctrl+V)" disabled={!connClipboard} onClick={connClipboard ? () => { hideContextMenu(); const cb = connClipboard!; connClipboard = null; ;(async () => { for (const id of cb.ids) { if (cb.op === 'cut') { await api.updateConnection(id, { folder_id: null }) } else { const conn = await api.getConnection(id); await api.createConnection({ name: conn.name + ' (副本)', host: conn.host, port: conn.port, username: conn.username, protocol: conn.protocol, auth_method: conn.auth_method, remark: conn.remark, color_tag: conn.color_tag, folder_id: null }) } } fetchAssets(); addToast('success', cb.op === 'cut' ? '已移动' : '已粘贴') })() } : undefined} />
            <div className="w-px h-3 bg-border mx-[1px]" />
            <ActionButton icon={icons.scissors} tooltip="剪切(Ctrl+X)" disabled={isBlank} onClick={!isBlank && rowData ? () => { hideContextMenu(); connClipboard = { ids: selectedRowIds.size > 0 ? [...selectedRowIds] : [rowData.id], op: 'cut' }; addToast('success', '已剪切') } : undefined} />
            <div className="w-px h-3 bg-border mx-[1px]" />
            <ActionButton icon={icons.copy} tooltip="复制(Ctrl+C)" disabled={isBlank} onClick={!isBlank && rowData ? () => { hideContextMenu(); connClipboard = { ids: selectedRowIds.size > 0 ? [...selectedRowIds] : [rowData.id], op: 'copy' }; addToast('success', '已复制') } : undefined} />
          </div>
        </div>
        <MenuItem icon={icons.link} label="打开" shortcut="Enter" disabled={isBlank} onClick={rowData && !isBlank ? () => { hideContextMenu(); openAssetTab(rowData) } : undefined} />
        <MenuItem icon={icons.copyPlus} label="批量打开" disabled={isBlank} onClick={() => { hideContextMenu(); batchOpenSelected() }} />
        <MenuItem icon={icons.refresh} label="刷新" shortcut="F5" onClick={() => { hideContextMenu(); fetchAssets() }} />
        <MenuItem icon={icons.filePlus} label="新标签打开" shortcut="Alt+N" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { hideContextMenu(); openAssetTab(rowData) } : undefined} />
        <MenuItem icon={icons.externalLink} label="新窗口打开" shortcut="Ctrl+Shift+N" disabled={isBlank || isFolder} />
        <MenuItem icon={icons.columns} label="同屏打开" disabled={isBlank || isFolder} onClick={!isBlank && !isFolder ? () => { hideContextMenu(); const rows: import('../../types').AssetRow[] = []; if (selectedRowIds.size > 0) { for (const id of selectedRowIds) { const r = tableData.find(row => row.id === id && row.type === 'asset'); if (r) rows.push(r) } } else if (rowData && rowData.type === 'asset') { rows.push(rowData) } if (rows.length > 0) openSplitTab(rows) } : undefined} />
        <MenuDivider />
        <MenuItem icon={icons.copy} label="克隆" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { hideContextMenu(); cloneConnectionAction(rowData.id) } : undefined} />
        <MenuItem icon={icons.folderPlus} label="新建目录" onClick={() => { hideContextMenu(); setShowDirModal(true) }} />
        <MenuItem icon={icons.link} label="新建连接" hasSubmenu>
          <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">新建连接</div>
          <NewConnectionSubmenu onSelectSsh={() => { hideContextMenu(); openSshConfig('create') }} onSelectLocalTerm={() => { hideContextMenu(); openLocalTermConfig('create') }} />
        </MenuItem>
        <MenuItem icon={icons.edit} label="编辑" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { hideContextMenu(); if (rowData.protocol === 'local') { openLocalTermConfig('edit', rowData.id) } else { openSshConfig('edit', rowData.id) } } : undefined} />
        <MenuItem icon={icons.copyPlus} label="批量编辑" disabled={isBlank || isFolder} />
        <MenuItem icon={icons.fileX} label="删除" shortcut="Backspace" disabled={isBlank} onClick={rowData && !isBlank ? () => handleDelete(rowData.id, rowData.type === 'folder' ? 'folder' : 'asset') : undefined} />
        <MenuItem icon={icons.edit} label="重命名" shortcut="F2" disabled={isBlank} onClick={rowData && !isBlank ? () => handleRename(rowData.id, rowData.type === 'folder' ? 'folder' : 'asset', rowData.name) : undefined} />
        <MenuDivider />
        <MenuItem icon={icons.chevronDown} label="更多" hasSubmenu disabled={isBlank}>
          <MenuItem icon={icons.fileDown} label="通过文本批量导入SSH" onClick={() => { hideContextMenu(); const text = prompt('请输入 SSH 连接信息（每行一条，格式：user@host:port）'); if (!text) return; ;(async () => { let count = 0; for (const line of text.split('\n')) { const m = line.trim().match(/^(\S+)@(\S+?)(?::(\d+))?$/); if (m) { await api.createConnection({ name: `${m[1]}@${m[2]}`, host: m[2], port: m[3] ? parseInt(m[3]) : 22, username: m[1] }); count++ } } fetchAssets(); addToast('success', `成功导入 ${count} 条连接`) })() }} />
          <MenuItem icon={icons.key} label="上传 SSH公钥(ssh-copy-id)" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { hideContextMenu(); api.getSshKeys().then(keys => { if (keys.length === 0) { addToast('error', '请先在密钥库中添加密钥'); return } const names = keys.map((k, i) => `${i + 1}. ${k.name}`).join('\n'); const idx = prompt(`选择要上传的公钥：\n${names}\n\n请输入序号`, '1'); if (!idx) return; const key = keys[parseInt(idx) - 1]; if (!key) { addToast('error', '无效的序号'); return } api.uploadSshKey(rowData.id, key.id).then(r => addToast('success', r.message)).catch(e => addToast('error', (e as Error).message)) }) } : undefined} />
          <MenuItem icon={icons.activity} label="Ping" disabled={isBlank || isFolder} onClick={rowData && !isBlank && !isFolder ? () => { hideContextMenu(); api.pingConnections([rowData.id]).then(result => { const ms = result[rowData.id]; addToast('success', `${rowData.name}: ${ms !== null ? `${ms}ms` : '超时'}`) }).catch(() => addToast('error', 'Ping 失败')) } : undefined} />
          <MenuItem icon={icons.fileDown} label="导入" onClick={() => { hideContextMenu(); pickJsonFile().then(async (data: any) => { const conns = Array.isArray(data) ? data : data.connections ?? [data]; let count = 0; for (const c of conns) { if (c.name && c.host) { await api.createConnection({ name: c.name, host: c.host, port: c.port, username: c.username ?? '', protocol: c.protocol, auth_method: c.auth_method, remark: c.remark, color_tag: c.color_tag, folder_id: c.folder_id }); count++ } } fetchAssets(); addToast('success', `成功导入 ${count} 条连接`) }).catch(() => {}) }} />
          <MenuItem icon={icons.fileUp} label="导出" onClick={() => { hideContextMenu(); if (selectedRowIds.size > 0) { const ids = [...selectedRowIds]; const connIds: string[] = []; for (const id of ids) { const r = tableData.find(row => row.id === id); if (!r) continue; if (r.type === 'asset') connIds.push(id); if (r.type === 'folder') tableData.filter(row => row.type === 'asset' && row.folderId === id).forEach(row => connIds.push(row.id)) } const unique = [...new Set(connIds)]; Promise.all(unique.map(id => api.getConnection(id))).then(conns => downloadJson({ connections: conns }, `vortix-export-${conns.length}.json`)) } else if (rowData) { api.getConnection(rowData.id).then(conn => downloadJson({ connections: [conn] }, `connection-${conn.name}.json`)) } else if (currentFolderId) { const folderConns = tableData.filter(r => r.type === 'asset' && r.folderId === currentFolderId); Promise.all(folderConns.map(r => api.getConnection(r.id))).then(conns => downloadJson({ connections: conns }, `vortix-folder-${conns.length}.json`)) } else { Promise.all([api.getFolders(), api.getConnections()]).then(([folders, connections]) => downloadJson({ folders, connections }, 'vortix-connections.json')) } }} />
        </MenuItem>
      </>
    )
  }
  // ---- 标签页右键菜单 ----
  else if (contextMenu.type === 'tab-context') {
    const data = contextMenu.data as TabContextData | null
    const tabId = data?.tabId ?? ''
    const tab = tabs.find(t => t.id === tabId)
    const assetTabs = tabs.filter(t => t.type === 'asset')
    const tabIdx = assetTabs.findIndex(t => t.id === tabId)
    const hasLeft = tabIdx > 0
    const hasRight = tabIdx >= 0 && tabIdx < assetTabs.length - 1
    const hasOthers = assetTabs.length > 1
    const assetRow = tab?.assetRow
    const connectionId = tab?.connectionId

    const handleRenameTab = () => {
      hideContextMenu()
      if (!tab) return
      const newName = prompt('请输入新的标签名称', tab.label)
      if (newName && newName !== tab.label) renameTab(tabId, newName)
    }

    content = (
      <>
        <div className="px-4 py-1 text-[11px] text-text-1 font-medium">标签页</div>
        <MenuItem icon={icons.close} label="关闭" shortcut="Ctrl+W" onClick={() => { hideContextMenu(); closeTab(tabId) }} />
        <MenuItem icon={icons.copy} label="复制名称" onClick={() => { hideContextMenu(); if (tab) navigator.clipboard.writeText(tab.label) }} />
        <MenuItem icon={icons.copy} label="复制 Host" disabled={!assetRow?.host || assetRow.host === '-'} onClick={assetRow?.host && assetRow.host !== '-' ? () => { hideContextMenu(); navigator.clipboard.writeText(assetRow.host) } : undefined} />
        <MenuItem icon={icons.edit} label="编辑连接" disabled={!connectionId} onClick={connectionId ? () => { hideContextMenu(); openSshConfig('edit', connectionId) } : undefined} />
        <MenuItem icon={icons.refresh} label="重新连接" onClick={() => { hideContextMenu(); reconnectTab(tabId) }} />
        <MenuDivider />
        <MenuItem icon={icons.squareX} label="关闭其他" shortcut="Alt+O" disabled={!hasOthers} onClick={hasOthers ? () => { hideContextMenu(); closeOtherTabs(tabId) } : undefined} />
        <MenuItem icon={icons.squareX} label="关闭所有" shortcut="Alt+C" onClick={() => { hideContextMenu(); closeAllTabs() }} />
        <MenuItem icon={icons.squareX} label="关闭左边" shortcut="Alt+L" disabled={!hasLeft} onClick={hasLeft ? () => { hideContextMenu(); closeLeftTabs(tabId) } : undefined} />
        <MenuItem icon={icons.squareX} label="关闭右边" shortcut="Alt+R" disabled={!hasRight} onClick={hasRight ? () => { hideContextMenu(); closeRightTabs(tabId) } : undefined} />
        <MenuDivider />
        <MenuItem icon={icons.edit} label="重命名" onClick={handleRenameTab} />
        <MenuItem icon={icons.externalLink} label="新窗口打开" disabled={!assetRow} />
        <MenuItem icon={icons.filePlus} label="新标签页打开" disabled={!connectionId} onClick={connectionId ? () => { hideContextMenu(); duplicateTab(tabId) } : undefined} />
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

    const handleTermCopy = () => {
      hideContextMenu()
      if (!termPaneId) return
      const session = getSession(termPaneId)
      const sel = session?.term.getSelection()
      if (sel) navigator.clipboard.writeText(sel).catch(() => {})
    }

    const handleTermPaste = () => {
      hideContextMenu()
      if (!termPaneId) return
      navigator.clipboard.readText().then((text) => {
        const session = getSession(termPaneId)
        if (text && session?.ws?.readyState === WebSocket.OPEN) {
          session.ws.send(JSON.stringify({ type: 'input', data: text }))
        }
      }).catch(() => {})
    }

    const selectionText = termPaneId ? (getSession(termPaneId)?.term.getSelection() ?? '') : ''

    const handleSearch = (engine: 'google' | 'bing' | 'baidu') => {
      hideContextMenu()
      if (!selectionText) return
      const q = encodeURIComponent(selectionText)
      const urls = {
        google: `https://www.google.com/search?q=${q}`,
        bing: `https://www.bing.com/search?q=${q}`,
        baidu: `https://www.baidu.com/s?wd=${q}`,
      }
      window.open(urls[engine], '_blank')
    }

    content = (
      <>
        <div className="px-4 py-1 text-[11px] text-text-1 font-medium">操作</div>
        <MenuItem icon={icons.copy} label="复制" shortcut="Ctrl+Shift+C" disabled={noSelection} onClick={handleTermCopy} />
        <MenuItem icon={icons.clipboard} label="粘贴" shortcut="Ctrl+Shift+V" onClick={handleTermPaste} />
        <MenuItem icon={icons.clipboardText} label="粘贴选中文本" disabled={noSelection} onClick={() => { hideContextMenu(); if (!termPaneId || !selectionText) return; const session = getSession(termPaneId); if (session?.ws?.readyState === WebSocket.OPEN) session.ws.send(JSON.stringify({ type: 'input', data: selectionText })) }} />
        <MenuItem icon={icons.search} label="搜索" hasSubmenu disabled={noSelection}>
          <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">搜索引擎</div>
          <MenuItem icon={icons.search} label="Google" onClick={() => handleSearch('google')} />
          <MenuItem icon={icons.search} label="Bing" onClick={() => handleSearch('bing')} />
          <MenuItem icon={icons.search} label="百度" onClick={() => handleSearch('baidu')} />
        </MenuItem>
        <MenuItem icon={icons.appWindow} label="通过服务器代理 Chrome" />
        <MenuDivider />
        <MenuItem icon={icons.squareArrowOutUpRight} label="新终端窗口" shortcut="Ctrl+Shift+N" disabled={!termTabId} onClick={termTabId ? () => { hideContextMenu(); duplicateTab(termTabId) } : undefined} />
        <MenuItem icon={icons.refresh} label="重新连接" shortcut="Ctrl+Shift+R" disabled={!termTabId} onClick={termTabId ? () => { hideContextMenu(); reconnectTab(termTabId) } : undefined} />
        <MenuItem icon={icons.trash} label="清屏" shortcut="Ctrl+Shift+L" disabled={!termPaneId} onClick={termPaneId ? () => { hideContextMenu(); getSession(termPaneId)?.term.clear() } : undefined} />
        <MenuItem icon={icons.squareX} label="断开连接" shortcut="Ctrl+W" disabled={!termTabId} onClick={termTabId ? () => { hideContextMenu(); closeTab(termTabId) } : undefined} />
        <MenuItem icon={icons.fileEdit} label="唤起输入框输入" shortcut="Ctrl+I" disabled={!termPaneId} onClick={termPaneId ? () => { hideContextMenu(); const cmd = prompt('请输入命令'); if (!cmd) return; const session = getSession(termPaneId); if (session?.ws?.readyState === WebSocket.OPEN) session.ws.send(JSON.stringify({ type: 'input', data: cmd + '\n' })) } : undefined} />
        <MenuDivider />
        <MenuItem icon={icons.splitVertical} label="垂直分屏" shortcut="Ctrl+Shift+=" onClick={() => handleSplit('vertical')} />
        <MenuItem icon={icons.splitHorizontal} label="水平分屏" shortcut="Ctrl+Shift+-" onClick={() => handleSplit('horizontal')} />
        <MenuItem icon={icons.squareX} label="关闭面板" disabled={paneCount <= 1} onClick={handleClosePane} />
        <MenuDivider />
        <MenuItem icon={icons.chevronDown} label="更多" hasSubmenu>
          <div className="px-4 py-1 text-[11px] text-text-1 border-b border-border/50 mb-1">更多</div>
          <MenuItem icon={icons.clock} label={termPaneId && recordingPanes.has(termPaneId) ? "停止记录日志" : "开始记录日志"} onClick={() => { hideContextMenu(); if (!termPaneId) return; const session = getSession(termPaneId); if (!session?.term) return; if (recordingPanes.has(termPaneId)) { const startLine = recordingPanes.get(termPaneId)!; recordingPanes.delete(termPaneId); const buf = session.term.buffer.active; const lines: string[] = []; for (let i = startLine; i < buf.length; i++) { const line = buf.getLine(i); if (line) lines.push(line.translateToString(true)) } const blob = new Blob([lines.join('\n')], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `terminal-record-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`; a.click(); URL.revokeObjectURL(url); addToast('success', '日志已保存') } else { recordingPanes.set(termPaneId, session.term.buffer.active.baseY + session.term.buffer.active.cursorY); addToast('success', '开始记录日志') } }} />
          <MenuItem icon={icons.save} label="保存为日志" onClick={() => { hideContextMenu(); if (!termPaneId) return; const session = getSession(termPaneId); if (!session?.term) return; const buf = session.term.buffer.active; const lines: string[] = []; for (let i = 0; i < buf.length; i++) { const line = buf.getLine(i); if (line) lines.push(line.translateToString(true)) } const blob = new Blob([lines.join('\n')], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `terminal-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`; a.click(); URL.revokeObjectURL(url) }} />
          <MenuItem icon={icons.terminalSquare} label="批量执行命令" onClick={() => { hideContextMenu(); const cmd = prompt('请输入要在所有终端中执行的命令'); if (!cmd) return; const allTabs = useTabStore.getState().tabs; const wsStore = useWorkspaceStore.getState(); let count = 0; for (const t of allTabs) { if (t.type !== 'asset') continue; const pids = wsStore.getAllPaneIds(t.id); for (const pid of pids) { const s = getSession(pid); if (s?.ws?.readyState === WebSocket.OPEN) { s.ws.send(JSON.stringify({ type: 'input', data: cmd + '\n' })); count++ } } } addToast('success', `命令已发送到 ${count} 个终端`) }} />
          <MenuItem icon={icons.fileDown} label="SCP 下载" shortcut="Ctrl+Shift+D" />
          <MenuItem icon={icons.fileUp} label="SCP 上传" shortcut="Ctrl+Shift+U" />
        </MenuItem>
      </>
    )
  }

  if (!content) return null

  const menuWidth = contextMenu.type === 'terminal' || contextMenu.type === 'tab-context' ? 'min-w-[260px]' : 'min-w-[210px]'

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
