/* ── SFTP 面板（真实组件容器 - 岛屿风格完善版） ── */

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSftpStore } from '../../stores/useSftpStore'
import { useSftpConnection } from '../../hooks/useSftpConnection'
import { useSftpActions } from './sftp/useSftpActions'
import { usePathSync } from './sftp/usePathSync'
import SftpNavBar from './sftp/SftpNavBar'
import SftpFileList from './sftp/SftpFileList'
import SftpStatusBar from './sftp/SftpStatusBar'
import SftpContextMenu from './sftp/SftpContextMenu'
import RemoteFileEditor from '../editor/RemoteFileEditor'
import SftpChmodModal from './sftp/SftpChmodModal'
import { uploadFiles } from '../../services/transfer-engine'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTabStore } from '../../stores/useTabStore'
import { useToastStore } from '../../stores/useToastStore'
import { isTextFile } from '../../lib/file-icons'
import { isBuiltinEditor, launchExternalEditor } from '../../services/editor-launcher'
import type { EditorType } from '../../services/editor-launcher'
import * as api from '../../api/client'
import type { SftpFileEntry } from '../../types/sftp'

interface Props {
  /** 关联的终端标签页 ID */
  targetTabId: string | null
  /** 隐藏面板 */
  hidden?: boolean
}

interface MenuState {
  visible: boolean
  x: number
  y: number
  entry: SftpFileEntry | null
}

const initialMenuState: MenuState = { visible: false, x: 0, y: 0, entry: null }

export default function SftpPanel({ targetTabId, hidden }: Props) {
  const connected = useSftpStore(s => s.connected)
  const connecting = useSftpStore(s => s.connecting)
  const addToast = useToastStore(s => s.addToast)

  const sftp = useSftpConnection()
  const connectAttempted = useRef(false)

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
    useSftpStore.getState().setPathSyncEnabled(settings.sshSftpPathSync)
    useSftpStore.getState().setShowHidden(settings.sftpShowHidden)
  }, [])

  useEffect(() => {
    if (!targetTabId || connected || connecting || connectAttempted.current) return
    connectAttempted.current = true
    const tab = useTabStore.getState().tabs.find(t => t.id === targetTabId)
    if (!tab || tab.type !== 'asset') return
    const resolve = async () => {
      try {
        const connId = tab.connectionId
        const quickConn = tab.quickConnect
        if (quickConn) {
          await sftp.connect({ host: quickConn.host, port: quickConn.port, username: quickConn.username, password: quickConn.password, privateKey: quickConn.privateKey })
        } else if (connId) {
          const cred = await api.getConnectionCredential(connId)
          await sftp.connect({ host: cred.host, port: cred.port, username: cred.username, password: cred.password, privateKey: cred.private_key, passphrase: cred.passphrase, connectionId: connId })
        } else if (tab.assetRow) {
          await sftp.connect({ host: tab.assetRow.host, port: 22, username: tab.assetRow.user })
        }
      } catch (err) { addToast('error', `SFTP 连接失败: ${(err as Error).message}`) }
    }
    void resolve()
  }, [targetTabId, connected, connecting, sftp, addToast])

  useEffect(() => { return () => { sftp.disconnect() } }, [sftp])

  const [editorFile, setEditorFile] = useState<{ path: string; content: string } | null>(null)
  const [chmodTarget, setChmodTarget] = useState<{ path: string; permissions: string; isDir: boolean } | null>(null)
  const openEditor = useCallback((path: string, content: string) => { setEditorFile({ path, content }) }, [])
  const actions = useSftpActions({ sftp, targetTabId, openEditor })
  const { syncToTerminal } = usePathSync({ targetTabId, onNavigate: actions.handleNavigate })
  const handleNavigateWithSync = useCallback((path: string) => { actions.handleNavigate(path); syncToTerminal(path) }, [actions, syncToTerminal])
  const [menuState, setMenuState] = useState<MenuState>(initialMenuState)
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: SftpFileEntry) => { setMenuState({ visible: true, x: e.clientX, y: e.clientY, entry }) }, [])
  const handleBlankContextMenu = useCallback((e: React.MouseEvent) => { setMenuState({ visible: true, x: e.clientX, y: e.clientY, entry: null }) }, [])
  const closeMenu = useCallback(() => { setMenuState(initialMenuState) }, [])

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

  return (
    <>
      <motion.div
        id="sftp-panel"
        className="shrink-0 flex flex-col bg-[#f8f9fa] overflow-hidden z-10 relative"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: panelWidth, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={isResizingPanel ? { duration: 0 } : { duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        style={hidden ? { display: 'none' } : undefined}
      >
        {/* Resize Handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/20 transition-colors z-30 group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 left-0 w-px bg-gray-200 group-hover:bg-primary/40" />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* 导航条 - 紧贴顶部以对齐终端 */}
          <SftpNavBar
            onNavigate={handleNavigateWithSync}
            onRefresh={sftp.refresh}
            onListDir={(path) => void sftp.listDir(path)}
            onSyncTerminal={syncToTerminal}
          />
          
          {/* 内容区域 - 保持岛屿感但向上靠拢 */}
          <div className="flex-1 flex flex-col min-h-0 mx-3 mb-3 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <SftpStatusBar />
            <SftpFileList
              onNavigate={handleNavigateWithSync}
              onContextMenu={handleContextMenu}
              onBlankContextMenu={handleBlankContextMenu}
              onDoubleClick={handleDoubleClick}
              onFileDrop={handleFileDrop}
              onRename={actions.handleRenameSubmit}
            />
          </div>
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
