/* ── SFTP 独立右键菜单 ── */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpClipboardStore } from '../../../stores/useSftpClipboardStore'
import type { SftpFileEntry } from '../../../types/sftp'

/** useSftpActions 返回的 handler 集合 */
interface SftpActions {
  handleEdit: (entry: SftpFileEntry) => void
  handleDownload: () => void
  handleUpload: () => void
  handleDelete: (path: string, isDir: boolean) => void
  handleDeleteSelected: () => void
  handleRename: (entry: SftpFileEntry) => void
  handleCopy: () => void
  handleCut: () => void
  handlePaste: () => void
  handleLocate: () => void
  handleCopyPath: (path: string) => void
  handleMkdir: () => void
  handleNewFile: () => void
  handleBookmark: () => void
  handleChmod: (path: string, mode: string, recursive: boolean) => void
  handleNavigate: (path: string) => void
  handleLocalOpen: (entry: SftpFileEntry) => void
  handleDownloadTo: (entry: SftpFileEntry) => void
  handleUploadFolder: () => void
  handleCompress: () => void
  handleDecompress: (entry: SftpFileEntry) => void
  handleScpDownload: () => void
  handleScpUpload: () => void
}

interface MenuState {
  visible: boolean
  x: number
  y: number
  entry: SftpFileEntry | null
}

interface Props {
  state: MenuState
  actions: SftpActions
  onClose: () => void
  onRefresh?: () => void
  onOpenChmod?: (path: string, permissions: string, isDir: boolean) => void
}

/* ── 菜单项 ── */
function Item({ icon, label, onClick, disabled }: {
  icon: string; label: string; onClick: () => void; disabled?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 h-[32px] mx-1 my-[1px] rounded-lg text-[13px] select-none transition-colors
        ${disabled ? 'text-text-disabled cursor-not-allowed' : 'text-text-1 hover:bg-bg-active cursor-pointer'}`}
      onClick={() => { if (!disabled) onClick() }}
    >
      <AppIcon icon={icon} size={15} className="opacity-80 shrink-0" />
      <span>{label}</span>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-border/60 mx-1.5 my-0.5" />
}

/* ── 子菜单项 ── */
function SubMenu({ icon, label, children }: {
  icon: string; label: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !ref.current || !subRef.current) return
    const rect = ref.current.getBoundingClientRect()
    const subEl = subRef.current
    const sub = subEl.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pos: Partial<CSSStyleDeclaration> = {
      left: '',
      right: '',
      top: '',
      bottom: '',
      marginLeft: '',
      marginRight: '',
    }
    if (rect.right + sub.width + 4 > vw) {
      pos.right = '100%'
      pos.marginRight = '4px'
    } else {
      pos.left = '100%'
      pos.marginLeft = '4px'
    }
    if (rect.top + sub.height > vh) {
      pos.bottom = '0px'
    } else {
      pos.top = '-6px'
    }
    Object.assign(subEl.style, pos)
  }, [open])

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-center justify-between px-3 h-[32px] mx-1 my-[1px] rounded-lg text-[13px] text-text-1 hover:bg-bg-active cursor-pointer select-none">
        <div className="flex items-center gap-3">
          <AppIcon icon={icon} size={15} className="opacity-80 shrink-0" />
          <span>{label}</span>
        </div>
        <AppIcon icon={icons.chevronRight} size={13} className="text-text-3" />
      </div>
      {open && (
        <div
          ref={subRef}
          className="absolute glass-context rounded-xl py-1 min-w-[180px] w-max z-[101]"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/* ── 主菜单 ── */
export default function SftpContextMenu({ state, actions, onClose, onRefresh, onOpenChmod }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const entries = useSftpStore(s => s.entries)
  const selectedPaths = useSftpStore(s => s.selectedPaths)
  const clipboardItems = useSftpClipboardStore(s => s.items)

  // 点击外部关闭
  useEffect(() => {
    if (!state.visible) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    // 延迟绑定，避免触发右键的 click 立即关闭
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [state.visible, onClose])

  // 位置调整（防溢出）
  useEffect(() => {
    if (!state.visible || !menuRef.current) return
    const frame = requestAnimationFrame(() => {
      if (!menuRef.current) return
      const rect = menuRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const pad = 4
      let left = state.x
      let top = state.y
      if (left + rect.width > vw - pad) left = vw - rect.width - pad
      if (left < pad) left = pad
      if (top + rect.height > vh - pad) top = vh - rect.height - pad
      if (top < pad) top = pad
      setPos({ top, left })
    })
    return () => cancelAnimationFrame(frame)
  }, [state.visible, state.x, state.y])

  if (!state.visible) return null

  const entry = state.entry
  const isDir = entry?.type === 'dir'
  const isFile = entry?.type === 'file'
  const selectedEntries = entries.filter((item) => selectedPaths.has(item.path))
  const selectedFiles = selectedEntries.filter((item) => item.type === 'file')
  const selectedCount = selectedEntries.length
  const multipleSelected = selectedCount > 1
  const hasClipboard = clipboardItems.length > 0
  const hasSelection = selectedCount > 0
  const close = onClose

  const menu = (
    <div
      ref={menuRef}
      className="fixed glass-context rounded-xl py-1 min-w-[220px] w-max z-[100]"
      style={{ top: pos.top || state.y, left: pos.left || state.x }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entry ? (
        <>
          <div className="flex items-center justify-between px-3 py-[4px] mb-1 border-b border-border/50">
            <span className="text-[11px] text-text-1 font-medium tracking-wide">
              {multipleSelected ? `已选择 ${selectedCount} 项` : '操作'}
            </span>
          </div>

          {/* ── 打开/编辑 ── */}
          {!multipleSelected && isFile && (
            <Item icon={icons.externalLink} label="本地打开" onClick={() => { close(); actions.handleLocalOpen(entry) }} />
          )}
          {!multipleSelected && isFile && (
            <Item icon={icons.fileEdit} label="在线编辑" onClick={() => { close(); actions.handleEdit(entry) }} />
          )}
          {!multipleSelected && isDir && (
            <Item icon={icons.folderOpen} label="打开目录" onClick={() => { close(); actions.handleNavigate(entry.path) }} />
          )}

          <Divider />

          {/* ── 剪贴板操作 ── */}
          <Item
            icon={icons.copy}
            label={multipleSelected ? '复制选中项' : '复制'}
            disabled={!hasSelection}
            onClick={() => { close(); actions.handleCopy() }}
          />
          <Item
            icon={icons.scissors}
            label={multipleSelected ? '剪切选中项' : '剪切'}
            disabled={!hasSelection}
            onClick={() => { close(); actions.handleCut() }}
          />
          <Item
            icon={icons.clipboardPaste}
            label="粘贴"
            disabled={!hasClipboard}
            onClick={() => { close(); actions.handlePaste() }}
          />

          <Divider />

          {/* ── 刷新 + 收藏 ── */}
          <Item icon={icons.refresh} label="刷新" onClick={() => { close(); onRefresh?.() }} />
          <Item icon={icons.pin} label="收藏当前路径" onClick={() => { close(); actions.handleBookmark() }} />

          <Divider />

          {/* ── 传输 ── */}
          {!multipleSelected && isFile && (
            <Item icon={icons.download} label="下载至" onClick={() => { close(); actions.handleDownloadTo(entry) }} />
          )}
          <Item
            icon={icons.download}
            label={multipleSelected ? '批量下载' : '下载'}
            disabled={selectedFiles.length === 0}
            onClick={() => { close(); actions.handleDownload() }}
          />
          <Item icon={icons.upload} label="上传文件" onClick={() => { close(); actions.handleUpload() }} />
          <Item icon={icons.folderOpen} label="上传文件夹" onClick={() => { close(); actions.handleUploadFolder() }} />

          {/* ── SCP 子菜单 ── */}
          <SubMenu icon={icons.arrowUpRight} label="SCP 传输">
            <Item icon={icons.download} label="SCP 下载" onClick={() => { close(); actions.handleScpDownload() }} />
            <Item icon={icons.upload} label="SCP 上传" onClick={() => { close(); actions.handleScpUpload() }} />
          </SubMenu>

          <Divider />

          {/* ── 压缩/解压 ── */}
          <Item
            icon={icons.folderArchive}
            label={multipleSelected ? '批量压缩' : '压缩'}
            disabled={!hasSelection}
            onClick={() => { close(); actions.handleCompress() }}
          />
          {!multipleSelected && isFile && (
            <Item icon={icons.fileDown} label="解压缩" onClick={() => { close(); actions.handleDecompress(entry) }} />
          )}

          <Divider />

          {/* ── 编辑操作 ── */}
          {!multipleSelected && (
            <Item icon={icons.pencil} label="重命名" onClick={() => { close(); actions.handleRename(entry) }} />
          )}
          {!multipleSelected ? (
            <Item icon={icons.trash} label="删除" onClick={() => { close(); actions.handleDelete(entry.path, isDir) }} />
          ) : (
            <Item
              icon={icons.trash}
              label="批量删除"
              onClick={() => {
                close()
                actions.handleDeleteSelected()
              }}
            />
          )}

          <Divider />

          {/* ── 更多 ▸ ── */}
          <SubMenu icon={icons.moreVertical} label="更多">
            {!multipleSelected && (
              <Item icon={icons.copy} label="复制路径" onClick={() => { close(); actions.handleCopyPath(entry.path) }} />
            )}
            {multipleSelected && (
              <Item icon={icons.copy} label="复制选中项路径" onClick={() => { close(); actions.handleCopyPath(selectedEntries.map((item) => item.path).join('\n')) }} />
            )}
            <Divider />
            <Item icon={icons.folderPlus} label="新建目录" onClick={() => { close(); actions.handleMkdir() }} />
            <Item icon={icons.filePlus} label="新建文件" onClick={() => { close(); actions.handleNewFile() }} />
            <Divider />
            {!multipleSelected && (
              <Item icon={icons.key} label="修改权限" onClick={() => {
                close()
                onOpenChmod?.(entry.path, entry.permissions || '', isDir ?? false)
              }} />
            )}
          </SubMenu>
        </>
      ) : (
        <>
          {/* ── 空白区域精简菜单 ── */}
          <Item
            icon={icons.clipboardPaste}
            label="粘贴"
            disabled={!hasClipboard}
            onClick={() => { close(); actions.handlePaste() }}
          />
          <Item icon={icons.refresh} label="刷新" onClick={() => { close(); onRefresh?.() }} />

          <Divider />

          <Item icon={icons.pin} label="收藏当前路径" onClick={() => { close(); actions.handleBookmark() }} />

          <Divider />

          <Item icon={icons.upload} label="上传文件" onClick={() => { close(); actions.handleUpload() }} />
          <Item icon={icons.folderOpen} label="上传文件夹" onClick={() => { close(); actions.handleUploadFolder() }} />

          <Divider />

          <Item icon={icons.folderPlus} label="新建目录" onClick={() => { close(); actions.handleMkdir() }} />
          <Item icon={icons.filePlus} label="新建文件" onClick={() => { close(); actions.handleNewFile() }} />
        </>
      )}
    </div>
  )

  return createPortal(menu, document.body)
}
