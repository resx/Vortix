/* ── SFTP 独立右键菜单 ── */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSftpStore } from '../../../stores/useSftpStore'
import { useSftpClipboardStore } from '../../../stores/useSftpClipboardStore'
import { BlankMenuContent } from './sftp-context-menu/BlankMenuContent'
import { EntryMenuContent } from './sftp-context-menu/EntryMenuContent'
import type { SftpContextMenuProps } from './sftp-context-menu/types'

export type { SftpActions, MenuState } from './sftp-context-menu/types'

export default function SftpContextMenu({
  sessionId = 'right',
  state,
  actions,
  onClose,
  onRefresh,
  onOpenChmod,
}: SftpContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const entries = useSftpStore((s) => s.sessions[sessionId].entries)
  const selectedPaths = useSftpStore((s) => s.sessions[sessionId].selectedPaths)
  const clipboardItems = useSftpClipboardStore((s) => s.items)

  useEffect(() => {
    if (!state.visible) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [state.visible, onClose])

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
  const selectedEntries = entries.filter((item) => selectedPaths.has(item.path))
  const selectedFiles = selectedEntries.filter((item) => item.type === 'file')
  const selectedCount = selectedEntries.length
  const hasClipboard = clipboardItems.length > 0
  const hasSelection = selectedCount > 0

  const menu = (
    <div
      ref={menuRef}
      className="fixed glass-context rounded-xl py-1 min-w-[220px] w-max z-[100]"
      style={{ top: pos.top || state.y, left: pos.left || state.x }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {entry ? (
        <EntryMenuContent
          entry={entry}
          selectedEntries={selectedEntries}
          selectedFiles={selectedFiles}
          selectedCount={selectedCount}
          hasSelection={hasSelection}
          hasClipboard={hasClipboard}
          actions={actions}
          onClose={onClose}
          onRefresh={onRefresh}
          onOpenChmod={onOpenChmod}
        />
      ) : (
        <BlankMenuContent
          hasClipboard={hasClipboard}
          actions={actions}
          onClose={onClose}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )

  return createPortal(menu, document.body)
}
