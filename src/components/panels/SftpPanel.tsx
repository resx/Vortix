/* ── SFTP 面板（双会话独立） ── */

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSftpStore } from '../../stores/useSftpStore'
import type { SftpSessionId } from '../../stores/useSftpStore'
import { useSftpConnection } from '../../hooks/useSftpConnection'
import { useSftpActions } from './sftp/useSftpActions'
import SftpContextMenu from './sftp/SftpContextMenu'
import SftpPanelContent from './sftp/SftpPanelContent'
import RemoteFileEditor from '../editor/RemoteFileEditor'
import SftpChmodModal from './sftp/SftpChmodModal'
import { uploadFiles, downloadFile } from '../../services/transfer-engine'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useToastStore } from '../../stores/useToastStore'
import * as api from '../../api/client'
import type { AssetRow } from '../../types'
import type { SftpFileEntry } from '../../types/sftp'
import {
  initialMenuState,
  sessionIdFromPane,
  type ActivePane,
  type MenuState,
  type PaneHostKind,
  type PaneSide,
} from './sftp/panel-types'

interface Props {
  targetTabId: string | null
  hidden?: boolean
  variant?: 'side' | 'workspace'
}

export default function SftpPanel({ targetTabId, hidden, variant = 'side' }: Props) {
  const addToast = useToastStore(s => s.addToast)
  const leftSession = useSftpStore(s => s.sessions.left)
  const rightSession = useSftpStore(s => s.sessions.right)
  const setActiveSession = useSftpStore(s => s.setActiveSession)
  const leftSftp = useSftpConnection('left')
  const rightSftp = useSftpConnection('right')

  const [editorFile, setEditorFile] = useState<{ sessionId: SftpSessionId; path: string; content: string } | null>(null)
  const [chmodTarget, setChmodTarget] = useState<{ sessionId: SftpSessionId; path: string; permissions: string; isDir: boolean } | null>(null)
  const [menuState, setMenuState] = useState<MenuState>(initialMenuState)
  const [activePane, setActivePane] = useState<ActivePane>('remote')
  const [leftHostKind, setLeftHostKind] = useState<PaneHostKind>('local')
  const [rightHostKind, setRightHostKind] = useState<PaneHostKind>('ssh')
  const [leftTitle, setLeftTitle] = useState('本地目录')
  const [rightTitle, setRightTitle] = useState('远程资产')
  const [showLeftPicker, setShowLeftPicker] = useState(false)
  const [showRightPicker, setShowRightPicker] = useState(true)
  const [splitRatio, setSplitRatio] = useState(0.5)

  const calculateInitialWidth = useCallback(() => Math.min(Math.round(window.innerWidth * 0.5), Math.max(360, 500)), [])
  const [panelWidth, setPanelWidth] = useState(calculateInitialWidth)
  const isResizing = useRef(false)
  const [isResizingPanel, setIsResizingPanel] = useState(false)
  const splitDraggingRef = useRef(false)
  const workspaceRef = useRef<HTMLDivElement | null>(null)

  const openEditor = useCallback((sessionId: SftpSessionId, path: string, content: string) => setEditorFile({ sessionId, path, content }), [])
  const leftActions = useSftpActions({ sessionId: 'left', sftp: leftSftp, targetTabId, openEditor: (path, content) => openEditor('left', path, content) })
  const rightActions = useSftpActions({ sessionId: 'right', sftp: rightSftp, targetTabId, openEditor: (path, content) => openEditor('right', path, content) })

  const transferEntriesToPeer = useCallback(async (sourceSessionId: SftpSessionId, entries: SftpFileEntry[]) => {
    const targetSessionId: SftpSessionId = sourceSessionId === 'left' ? 'right' : 'left'
    const sourceSftp = sourceSessionId === 'left' ? leftSftp : rightSftp
    const targetSftp = targetSessionId === 'left' ? leftSftp : rightSftp
    const sourceSession = useSftpStore.getState().getSessionState(sourceSessionId)
    const targetSession = useSftpStore.getState().getSessionState(targetSessionId)
    if (!sourceSession.connected || !targetSession.connected) return addToast('error', '源会话或对侧会话未连接')

    const filesOnly = entries.filter(item => item.type === 'file')
    const skipped = entries.length - filesOnly.length
    let success = 0
    let failed = 0
    for (const item of filesOnly) {
      try {
        const { promise } = downloadFile(sourceSftp.send, item.path, item.name, item.size, sourceSessionId)
        const file = new File([await promise], item.name)
        await uploadFiles(targetSftp.send, [file], targetSession.currentPath, targetSessionId)
        success += 1
      } catch {
        failed += 1
      }
    }
    targetSftp.refresh()
    if (success > 0 && failed === 0 && skipped === 0) return addToast('success', `已传输 ${success} 个文件到对侧`)
    const segments = [`成功 ${success}`]
    if (failed > 0) segments.push(`失败 ${failed}`)
    if (skipped > 0) segments.push(`跳过目录 ${skipped}`)
    addToast(failed > 0 ? 'error' : 'info', `传输完成：${segments.join('，')}`)
  }, [addToast, leftSftp, rightSftp])

  const handleContextMenu = useCallback((pane: PaneSide, e: React.MouseEvent, entry: SftpFileEntry) => {
    setMenuState({ visible: true, x: e.clientX, y: e.clientY, entry, pane })
    setActivePane(pane === 'left' ? 'local' : 'remote')
  }, [])
  const handleBlankContextMenu = useCallback((pane: PaneSide, e: React.MouseEvent) => {
    setMenuState({ visible: true, x: e.clientX, y: e.clientY, entry: null, pane })
    setActivePane(pane === 'left' ? 'local' : 'remote')
  }, [])
  const closeMenu = useCallback(() => setMenuState(initialMenuState), [])

  const handleFileDrop = useCallback(async (sessionId: SftpSessionId, files: File[]) => {
    const session = useSftpStore.getState().getSessionState(sessionId)
    const sftp = sessionId === 'left' ? leftSftp : rightSftp
    if (!session.connected || files.length === 0) return
    const { currentPath } = session
    try {
      await uploadFiles(sftp.send, files, currentPath, sessionId)
      sftp.refresh()
      addToast('success', `${files.length} 个文件上传完成`)
    } catch (err) {
      addToast('error', `上传失败: ${(err as Error).message}`)
    }
  }, [leftSftp, rightSftp, addToast])

  const handleDoubleClick = useCallback((sessionId: SftpSessionId, entry: SftpFileEntry) => {
    const session = useSftpStore.getState().getSessionState(sessionId)
    const isSingleSelected = session.selectedPaths.size === 1 && session.selectedPaths.has(entry.path)
    if (isSingleSelected) void transferEntriesToPeer(sessionId, [entry])
  }, [transferEntriesToPeer])
  const handleTransferToPeerFromMenu = useCallback(() => {
    const activeMenuSession = sessionIdFromPane(menuState.pane)
    const session = useSftpStore.getState().getSessionState(activeMenuSession)
    const selected = session.entries.filter(item => session.selectedPaths.has(item.path))
    if (selected.length > 0) return void transferEntriesToPeer(activeMenuSession, selected)
    if (menuState.entry) return void transferEntriesToPeer(activeMenuSession, [menuState.entry])
    addToast('info', '请先选择要传输的项目')
  }, [addToast, menuState.entry, menuState.pane, transferEntriesToPeer])

  const handleEditorSave = useCallback(async (content: string) => {
    if (!editorFile) return
    const sftp = editorFile.sessionId === 'left' ? leftSftp : rightSftp
    await sftp.writeFile(editorFile.path, content)
  }, [editorFile, leftSftp, rightSftp])

  const handleSelectLocal = useCallback((side: PaneSide) => {
    if (side === 'left') return setLeftHostKind('local'), setLeftTitle('本地目录'), setShowLeftPicker(false)
    setRightHostKind('local'); setRightTitle('本地目录'); setShowRightPicker(false)
  }, [])
  const handleConnectAsset = useCallback(async (side: PaneSide, asset: AssetRow) => {
    if (!asset.id) return
    const sessionId = sessionIdFromPane(side)
    const sftp = sessionId === 'left' ? leftSftp : rightSftp
    const session = useSftpStore.getState().getSessionState(sessionId)
    try {
      if (session.connected) sftp.disconnect()
      const cred = await api.getConnectionCredential(asset.id)
      await sftp.connect({ host: cred.host, port: cred.port, username: cred.username, password: cred.password, privateKey: cred.private_key, passphrase: cred.passphrase, connectionId: asset.id, connectionName: asset.name, jump: cred.jump ? { connectionId: cred.jump.connectionId, connectionName: cred.jump.connectionName, host: cred.jump.host, port: cred.jump.port, username: cred.jump.username, password: cred.jump.password, privateKey: cred.jump.private_key, passphrase: cred.jump.passphrase } : undefined })
      if (side === 'left') { setLeftHostKind('ssh'); setLeftTitle(asset.name); setShowLeftPicker(false) }
      else { setRightHostKind('ssh'); setRightTitle(asset.name); setShowRightPicker(false) }
      addToast('success', `已连接 ${asset.name}`)
    } catch (err) {
      addToast('error', `SFTP 连接失败: ${(err as Error).message}`)
    }
  }, [addToast, leftSftp, rightSftp])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const width = window.innerWidth - e.clientX
      if (width >= 360 && width <= window.innerWidth * 0.5) setPanelWidth(width)
      if (!splitDraggingRef.current || !workspaceRef.current) return
      const rect = workspaceRef.current.getBoundingClientRect()
      setSplitRatio(Math.min(0.75, Math.max(0.25, (e.clientX - rect.left) / rect.width)))
    }
    const onUp = () => {
      if (isResizing.current) { isResizing.current = false; setIsResizingPanel(false); window.dispatchEvent(new Event('resize')) }
      if (splitDraggingRef.current) splitDraggingRef.current = false
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])
  useEffect(() => { useSftpStore.getState().setShowHidden(useSettingsStore.getState().sftpShowHidden) }, [])
  useEffect(() => () => { leftSftp.disconnect(); rightSftp.disconnect() }, [leftSftp, rightSftp])
  useEffect(() => setActiveSession(activePane === 'local' ? 'left' : 'right'), [activePane, setActiveSession])

  const isWorkspace = variant === 'workspace'
  const activeMenuSession = sessionIdFromPane(menuState.pane)
  const activeMenuActions = activeMenuSession === 'left' ? leftActions : rightActions
  const activeMenuSftp = activeMenuSession === 'left' ? leftSftp : rightSftp
  const leftDisplayTitle = leftHostKind === 'ssh' ? (leftSession.connectionName || leftTitle) : leftTitle
  const rightDisplayTitle = rightHostKind === 'ssh' ? (rightSession.connectionName || rightTitle) : rightTitle

  return (
    <>
      <motion.div
        id="sftp-panel"
        className={`${isWorkspace ? 'w-full flex-1' : 'shrink-0'} flex flex-col bg-[#f8f9fa] overflow-hidden z-10 relative`}
        initial={isWorkspace ? { opacity: 0 } : { width: 0, opacity: 0 }}
        animate={isWorkspace ? { opacity: 1 } : { width: panelWidth, opacity: 1 }}
        exit={isWorkspace ? { opacity: 0 } : { width: 0, opacity: 0 }}
        transition={isResizingPanel ? { duration: 0 } : { duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        style={hidden ? { display: 'none' } : undefined}
      >
        {!isWorkspace && <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-30 group" onMouseDown={(e) => { e.preventDefault(); isResizing.current = true; setIsResizingPanel(true); document.body.style.cursor = 'col-resize' }}><div className="absolute inset-y-0 left-0 w-px bg-gray-200 group-hover:bg-primary/40" /></div>}

        <SftpPanelContent
          isWorkspace={isWorkspace}
          activePane={activePane}
          splitRatio={splitRatio}
          workspaceRef={workspaceRef}
          splitDraggingRef={splitDraggingRef}
          rightConnected={rightSession.connected}
          rightConnecting={rightSession.connecting}
          left={{ side: 'left', sessionId: 'left', title: leftDisplayTitle, active: activePane === 'local', hostKind: leftHostKind, showPicker: showLeftPicker, session: leftSession, onActivate: () => { setActivePane('local'); setActiveSession('left') }, onShowPicker: () => setShowLeftPicker(true), onSelectLocal: () => handleSelectLocal('left'), onSelectAsset: (asset) => { void handleConnectAsset('left', asset) }, onNavigate: leftActions.handleNavigate, onListDir: (path) => void leftSftp.listDir(path), onRefresh: leftSftp.refresh, onContextMenu: handleContextMenu, onBlankContextMenu: handleBlankContextMenu, onDoubleClick: handleDoubleClick, onFileDrop: (sessionId, files) => { void handleFileDrop(sessionId, files) }, onRemoteDrop: (entries, sourceSessionId) => { void transferEntriesToPeer(sourceSessionId, entries) }, onRename: leftActions.handleRenameSubmit }}
          right={{ side: 'right', sessionId: 'right', title: rightDisplayTitle, active: activePane === 'remote', hostKind: rightHostKind, showPicker: showRightPicker, session: rightSession, onActivate: () => { setActivePane('remote'); setActiveSession('right') }, onShowPicker: () => setShowRightPicker(true), onSelectLocal: () => handleSelectLocal('right'), onSelectAsset: (asset) => { void handleConnectAsset('right', asset) }, onNavigate: rightActions.handleNavigate, onListDir: (path) => void rightSftp.listDir(path), onRefresh: rightSftp.refresh, onContextMenu: handleContextMenu, onBlankContextMenu: handleBlankContextMenu, onDoubleClick: handleDoubleClick, onFileDrop: (sessionId, files) => { void handleFileDrop(sessionId, files) }, onRemoteDrop: (entries, sourceSessionId) => { void transferEntriesToPeer(sourceSessionId, entries) }, onRename: rightActions.handleRenameSubmit }}
        />

        <SftpContextMenu
          sessionId={activeMenuSession}
          state={menuState}
          actions={{ ...activeMenuActions, handleTransferToPeer: handleTransferToPeerFromMenu }}
          onClose={closeMenu}
          onRefresh={activeMenuSftp.refresh}
          onOpenChmod={(path, permissions, isDir) => setChmodTarget({ sessionId: activeMenuSession, path, permissions, isDir })}
        />
      </motion.div>

      {editorFile && <RemoteFileEditor filePath={editorFile.path} content={editorFile.content} onSave={handleEditorSave} onClose={() => setEditorFile(null)} />}
      {chmodTarget && <SftpChmodModal isOpen filePath={chmodTarget.path} currentMode={chmodTarget.permissions} isDir={chmodTarget.isDir} onApply={(mode, recursive) => (chmodTarget.sessionId === 'left' ? leftActions : rightActions).handleChmod(chmodTarget.path, mode, recursive)} onClose={() => setChmodTarget(null)} />}
    </>
  )
}
