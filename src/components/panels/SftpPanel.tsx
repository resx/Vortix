/* ── SFTP 面板（真实组件容器 - 岛屿风格完善版） ── */

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSftpStore } from '../../stores/useSftpStore'
import { useSftpConnection } from '../../hooks/useSftpConnection'
import { useSftpActions } from './sftp/useSftpActions'
import SftpNavBar from './sftp/SftpNavBar'
import SftpFileList from './sftp/SftpFileList'
import SftpContextMenu from './sftp/SftpContextMenu'
import SftpLocalFileList from './sftp/SftpLocalFileList'
import SftpRemotePaneHeader from './sftp/SftpRemotePaneHeader'
import SftpHostPicker from './sftp/SftpHostPicker'
import RemoteFileEditor from '../editor/RemoteFileEditor'
import SftpChmodModal from './sftp/SftpChmodModal'
import { uploadFiles } from '../../services/transfer-engine'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useToastStore } from '../../stores/useToastStore'
import { isTextFile } from '../../lib/file-icons'
import { isBuiltinEditor, launchExternalEditor } from '../../services/editor-launcher'
import type { EditorType } from '../../services/editor-launcher'
import * as api from '../../api/client'
import type { AssetRow } from '../../types'
import type { SftpFileEntry } from '../../types/sftp'

interface Props {
  /** 关联的终端标签页 ID */
  targetTabId: string | null
  /** 隐藏面板 */
  hidden?: boolean
  /** 展示形态 */
  variant?: 'side' | 'workspace'
}

interface MenuState {
  visible: boolean
  x: number
  y: number
  entry: SftpFileEntry | null
}

const initialMenuState: MenuState = { visible: false, x: 0, y: 0, entry: null }
type PaneSide = 'left' | 'right'
type PaneHostKind = 'local' | 'ssh'

export default function SftpPanel({ targetTabId, hidden, variant = 'side' }: Props) {
  const connected = useSftpStore(s => s.connected)
  const connecting = useSftpStore(s => s.connecting)
  const connectionName = useSftpStore(s => s.connectionName)
  const addToast = useToastStore(s => s.addToast)

  const sftp = useSftpConnection()

  const calculateInitialWidth = useCallback(() => {
    const minWidth = 360
    const idealWidth = 500
    const maxWidth = Math.round(window.innerWidth * 0.5)
    return Math.min(maxWidth, Math.max(minWidth, idealWidth))
  }, [])

  const [panelWidth, setPanelWidth] = useState(calculateInitialWidth)
  const isResizing = useRef(false)
  const [isResizingPanel, setIsResizingPanel] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    setIsResizingPanel(true)
    document.body.style.cursor = 'col-resize'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = window.innerWidth - e.clientX
      const maxWidth = window.innerWidth * 0.5
      const minWidth = 360
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPanelWidth(newWidth)
      }
    }
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false
        setIsResizingPanel(false)
        document.body.style.cursor = ''
        window.dispatchEvent(new Event('resize'))
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      isResizing.current = false
      document.body.style.cursor = ''
    }
  }, [])

  useEffect(() => { setPanelWidth(calculateInitialWidth()) }, [calculateInitialWidth])

  useEffect(() => {
    const settings = useSettingsStore.getState()
    useSftpStore.getState().setShowHidden(settings.sftpShowHidden)
  }, [])

  useEffect(() => { return () => { sftp.disconnect() } }, [sftp])

  const [editorFile, setEditorFile] = useState<{ path: string; content: string } | null>(null)
  const [chmodTarget, setChmodTarget] = useState<{ path: string; permissions: string; isDir: boolean } | null>(null)
  const openEditor = useCallback((path: string, content: string) => { setEditorFile({ path, content }) }, [])
  const actions = useSftpActions({ sftp, targetTabId, openEditor })
  const handleNavigate = useCallback((path: string) => { actions.handleNavigate(path) }, [actions])
  const [menuState, setMenuState] = useState<MenuState>(initialMenuState)
  const [activePane, setActivePane] = useState<'local' | 'remote'>('remote')
  const [leftHostKind, setLeftHostKind] = useState<PaneHostKind>('local')
  const [rightHostKind, setRightHostKind] = useState<PaneHostKind>('ssh')
  const [leftTitle, setLeftTitle] = useState('本地目录')
  const [rightTitle, setRightTitle] = useState('远程资产')
  const [showLeftPicker, setShowLeftPicker] = useState(false)
  const [showRightPicker, setShowRightPicker] = useState(true)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const splitDraggingRef = useRef(false)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: SftpFileEntry) => { setMenuState({ visible: true, x: e.clientX, y: e.clientY, entry }) }, [])
  const handleBlankContextMenu = useCallback((e: React.MouseEvent) => { setMenuState({ visible: true, x: e.clientX, y: e.clientY, entry: null }) }, [])
  const closeMenu = useCallback(() => { setMenuState(initialMenuState) }, [])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!splitDraggingRef.current || !workspaceRef.current) return
      const rect = workspaceRef.current.getBoundingClientRect()
      const raw = (e.clientX - rect.left) / rect.width
      const clamped = Math.min(0.75, Math.max(0.25, raw))
      setSplitRatio(clamped)
    }
    const handleUp = () => {
      if (!splitDraggingRef.current) return
      splitDraggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  const handleFileDrop = useCallback(async (files: File[]) => {
    if (!connected || files.length === 0) return
    const { currentPath } = useSftpStore.getState()
    const hasSubDirs = files.some(f => f.webkitRelativePath?.includes('/'))
    if (hasSubDirs) {
      const dirs = new Set<string>()
      for (const file of files) {
        const rel = file.webkitRelativePath
        if (!rel) continue
        const parts = rel.split('/')
        for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
      }
      const sortedDirs = [...dirs].sort((a, b) => a.split('/').length - b.split('/').length)
      for (const dir of sortedDirs) {
        const remoteDirPath = currentPath === '/' ? `/${dir}` : `${currentPath}/${dir}`
        try { await sftp.mkdir(remoteDirPath) } catch { continue }
      }
      for (const file of files) {
        const rel = file.webkitRelativePath
        if (!rel) continue
        const parentDir = rel.substring(0, rel.lastIndexOf('/'))
        const remotePath = parentDir ? (currentPath === '/' ? `/${parentDir}` : `${currentPath}/${parentDir}`) : currentPath
        try { await uploadFiles(sftp.send, [file], remotePath) } catch { continue }
      }
      sftp.refresh(); addToast('success', `文件夹上传完成 (${files.length} 个文件)`)
    } else {
      try { await uploadFiles(sftp.send, files, currentPath); sftp.refresh(); addToast('success', `${files.length} 个文件上传完成`) }
      catch (err) { addToast('error', `上传失败: ${(err as Error).message}`) }
    }
  }, [connected, sftp, addToast])

  const handleDoubleClick = useCallback((entry: SftpFileEntry) => {
    if (entry.type !== 'file') return
    const { sftpDoubleClickAction, sftpDefaultEditor } = useSettingsStore.getState()
    const shouldEdit = sftpDoubleClickAction === 'edit' || (sftpDoubleClickAction === 'auto' && isTextFile(entry.name))
    if (shouldEdit) {
      if (isBuiltinEditor(sftpDefaultEditor as EditorType)) actions.handleEdit(entry)
      else launchExternalEditor(entry.path, { type: sftpDefaultEditor as EditorType }).catch(err => addToast('error', `启动编辑器失败: ${(err as Error).message}`))
    } else actions.handleLocalOpen(entry)
  }, [actions, addToast])

  const handleEditorSave = useCallback(async (content: string) => { if (!editorFile) return; await sftp.writeFile(editorFile.path, content) }, [editorFile, sftp])
  const handleSelectLocal = useCallback((side: PaneSide) => {
    if (side === 'left') {
      setLeftHostKind('local')
      setLeftTitle('本地目录')
      setShowLeftPicker(false)
      return
    }
    setRightHostKind('local')
    setRightTitle('本地目录')
    setShowRightPicker(false)
  }, [])

  const handleConnectAsset = useCallback(async (side: PaneSide, asset: AssetRow) => {
    if (!asset.id) return
    try {
      if (connected) {
        sftp.disconnect()
      }
      const cred = await api.getConnectionCredential(asset.id)
      await sftp.connect({
        host: cred.host,
        port: cred.port,
        username: cred.username,
        password: cred.password,
        privateKey: cred.private_key,
        passphrase: cred.passphrase,
        connectionId: asset.id,
        connectionName: asset.name,
        jump: cred.jump ? {
          connectionId: cred.jump.connectionId,
          connectionName: cred.jump.connectionName,
          host: cred.jump.host,
          port: cred.jump.port,
          username: cred.jump.username,
          password: cred.jump.password,
          privateKey: cred.jump.private_key,
          passphrase: cred.jump.passphrase,
        } : undefined,
      })
      if (side === 'left') {
        setLeftHostKind('ssh')
        setLeftTitle(asset.name)
        setShowLeftPicker(false)
      } else {
        setRightHostKind('ssh')
        setRightTitle(asset.name)
        setShowRightPicker(false)
      }
      addToast('success', `已连接 ${asset.name}`)
    } catch (err) {
      addToast('error', `SFTP 连接失败: ${(err as Error).message}`)
    }
  }, [addToast, connected, sftp])

  useEffect(() => {
    if (!connectionName) return
    if (leftHostKind === 'ssh') setLeftTitle(connectionName)
    if (rightHostKind === 'ssh') setRightTitle(connectionName)
  }, [connectionName, leftHostKind, rightHostKind])

  const isWorkspace = variant === 'workspace'

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
        {!isWorkspace && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-30 group"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute inset-y-0 left-0 w-px bg-gray-200 group-hover:bg-primary/40" />
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          {!isWorkspace && (
            <SftpNavBar
              onNavigate={handleNavigate}
              onRefresh={sftp.refresh}
              onListDir={(path) => void sftp.listDir(path)}
            />
          )}
          
          {/* 内容区域 - 保持岛屿感但向上靠拢 */}
          {isWorkspace ? (
            <div className="flex-1 min-h-0 px-4 pb-4">
              <div ref={workspaceRef} className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div
                  className={`min-w-0 flex flex-col transition-opacity ${activePane === 'local' ? 'opacity-100' : 'opacity-90'}`}
                  style={{ width: `${Math.round(splitRatio * 100)}%` }}
                  onMouseDown={() => setActivePane('local')}
                >
                  {showLeftPicker ? (
                    <SftpHostPicker
                      title="左侧 Host"
                      connecting={connecting}
                      onSelectLocal={() => handleSelectLocal('left')}
                      onSelectAsset={(asset) => { void handleConnectAsset('left', asset) }}
                    />
                  ) : leftHostKind === 'local' ? (
                    <SftpLocalFileList
                      title={leftTitle}
                      active={activePane === 'local'}
                      embedded
                      onTitleClick={() => setShowLeftPicker(true)}
                    />
                  ) : (
                    <>
                      <SftpRemotePaneHeader
                        title={leftTitle}
                        active={activePane === 'local'}
                        onNavigate={handleNavigate}
                        onRefresh={sftp.refresh}
                        onListDir={(path) => void sftp.listDir(path)}
                        onTitleClick={() => setShowLeftPicker(true)}
                      />
                      {connected || connecting ? (
                        <SftpFileList
                          onNavigate={handleNavigate}
                          onContextMenu={handleContextMenu}
                          onBlankContextMenu={handleBlankContextMenu}
                          onDoubleClick={handleDoubleClick}
                          onFileDrop={handleFileDrop}
                          onRename={actions.handleRenameSubmit}
                        />
                      ) : (
                        <SftpHostPicker
                          title="左侧 Host"
                          connecting={connecting}
                          onSelectLocal={() => handleSelectLocal('left')}
                          onSelectAsset={(asset) => { void handleConnectAsset('left', asset) }}
                        />
                      )}
                    </>
                  )}
                </div>
                <div
                  className="relative w-1 cursor-col-resize bg-gray-200 hover:bg-primary/40"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    splitDraggingRef.current = true
                    document.body.style.cursor = 'col-resize'
                    document.body.style.userSelect = 'none'
                  }}
                >
                  <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300" />
                </div>
                <div
                  className={`min-w-0 flex flex-1 flex-col transition-opacity ${activePane === 'remote' ? 'opacity-100' : 'opacity-90'}`}
                  onMouseDown={() => setActivePane('remote')}
                >
                  {showRightPicker ? (
                    <SftpHostPicker
                      title="右侧 Host"
                      connecting={connecting}
                      onSelectLocal={() => handleSelectLocal('right')}
                      onSelectAsset={(asset) => { void handleConnectAsset('right', asset) }}
                    />
                  ) : rightHostKind === 'local' ? (
                    <SftpLocalFileList
                      title={rightTitle}
                      active={activePane === 'remote'}
                      embedded
                      onTitleClick={() => setShowRightPicker(true)}
                    />
                  ) : (
                    <>
                      <SftpRemotePaneHeader
                        title={rightTitle}
                        active={activePane === 'remote'}
                        onNavigate={handleNavigate}
                        onRefresh={sftp.refresh}
                        onListDir={(path) => void sftp.listDir(path)}
                        onTitleClick={() => setShowRightPicker(true)}
                      />
                      {connected || connecting ? (
                        <SftpFileList
                          onNavigate={handleNavigate}
                          onContextMenu={handleContextMenu}
                          onBlankContextMenu={handleBlankContextMenu}
                          onDoubleClick={handleDoubleClick}
                          onFileDrop={handleFileDrop}
                          onRename={actions.handleRenameSubmit}
                        />
                      ) : (
                        <SftpHostPicker
                          title="右侧 Host"
                          connecting={connecting}
                          onSelectLocal={() => handleSelectLocal('right')}
                          onSelectAsset={(asset) => { void handleConnectAsset('right', asset) }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 mx-3 mb-3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <SftpFileList
                onNavigate={handleNavigate}
                onContextMenu={handleContextMenu}
                onBlankContextMenu={handleBlankContextMenu}
                onDoubleClick={handleDoubleClick}
                onFileDrop={handleFileDrop}
                onRename={actions.handleRenameSubmit}
              />
            </div>
          )}
        </div>

        <SftpContextMenu
          state={menuState}
          actions={actions}
          onClose={closeMenu}
          onRefresh={sftp.refresh}
          onOpenChmod={(path, permissions, isDir) => setChmodTarget({ path, permissions, isDir })}
        />
      </motion.div>

      {editorFile && (
        <RemoteFileEditor
          filePath={editorFile.path}
          content={editorFile.content}
          onSave={handleEditorSave}
          onClose={() => setEditorFile(null)}
        />
      )}

      {chmodTarget && (
        <SftpChmodModal
          isOpen
          filePath={chmodTarget.path}
          currentMode={chmodTarget.permissions}
          isDir={chmodTarget.isDir}
          onApply={(mode, recursive) => { actions.handleChmod(chmodTarget.path, mode, recursive) }}
          onClose={() => setChmodTarget(null)}
        />
      )}
    </>
  )
}
