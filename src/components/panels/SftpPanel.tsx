/* ── SFTP 面板（真实组件容器） ── */

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSftpStore } from '../../stores/useSftpStore'
import { useSftpConnection } from '../../hooks/useSftpConnection'
import { useSftpActions } from './sftp/useSftpActions'
import { usePathSync } from './sftp/usePathSync'
import SftpNavBar from './sftp/SftpNavBar'
import SftpFileList from './sftp/SftpFileList'
import SftpStatusBar from './sftp/SftpStatusBar'
import SftpContextMenu, { initialState as menuInitial } from './sftp/SftpContextMenu'
import type { MenuState } from './sftp/SftpContextMenu'
import RemoteFileEditor from '../editor/RemoteFileEditor'
import SftpChmodModal from './sftp/SftpChmodModal'
import { uploadFiles } from '../../services/transfer-engine'
import { useToastStore } from '../../stores/useToastStore'
import { useTabStore } from '../../stores/useTabStore'
import * as api from '../../api/client'
import type { SftpFileEntry } from '../../types/sftp'

interface Props {
  /** 关联的终端标签页 ID（用于定位功能） */
  targetTabId: string | null
  /** 隐藏面板（切换标签页时保持连接不卸载） */
  hidden?: boolean
}

export default function SftpPanel({ targetTabId, hidden }: Props) {
  const connected = useSftpStore(s => s.connected)
  const connecting = useSftpStore(s => s.connecting)
  const addToast = useToastStore(s => s.addToast)

  const sftp = useSftpConnection()
  const connectAttempted = useRef(false)

  // 自动连接：面板挂载时解析当前标签页的 SSH 凭据并建立 SFTP 连接
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
          await sftp.connect({
            host: quickConn.host,
            port: quickConn.port,
            username: quickConn.username,
            password: quickConn.password,
            privateKey: quickConn.privateKey,
          })
        } else if (connId) {
          const cred = await api.getConnectionCredential(connId)
          await sftp.connect({
            host: cred.host,
            port: cred.port,
            username: cred.username,
            password: cred.password,
            privateKey: cred.private_key,
            passphrase: cred.passphrase,
            connectionId: connId,
          })
        } else if (tab.assetRow) {
          await sftp.connect({
            host: tab.assetRow.host,
            port: 22,
            username: tab.assetRow.user,
          })
        }
      } catch (err) {
        addToast('error', `SFTP 连接失败: ${(err as Error).message}`)
      }
    }

    void resolve()
  }, [targetTabId, connected, connecting, sftp, addToast])

  // 面板卸载时断开 SFTP 连接
  useEffect(() => {
    return () => {
      sftp.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 编辑器状态
  const [editorFile, setEditorFile] = useState<{ path: string; content: string } | null>(null)

  // chmod 弹窗状态
  const [chmodTarget, setChmodTarget] = useState<{ path: string; permissions: string; isDir: boolean } | null>(null)

  const openEditor = useCallback((path: string, content: string) => {
    setEditorFile({ path, content })
  }, [])

  const actions = useSftpActions({ sftp, targetTabId, openEditor })

  // 路径联动
  usePathSync(targetTabId, actions.handleNavigate)

  // 右键菜单状态
  const [menuState, setMenuState] = useState<MenuState>(menuInitial)

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: SftpFileEntry) => {
    setMenuState({ visible: true, x: e.clientX, y: e.clientY, entry })
  }, [])

  const handleBlankContextMenu = useCallback((e: React.MouseEvent) => {
    setMenuState({ visible: true, x: e.clientX, y: e.clientY, entry: null })
  }, [])

  const closeMenu = useCallback(() => {
    setMenuState(menuInitial)
  }, [])

  // 拖入上传（支持文件夹结构）
  const handleFileDrop = useCallback(async (files: File[]) => {
    if (!connected || files.length === 0) return
    const { currentPath } = useSftpStore.getState()

    // 检查是否包含文件夹结构（webkitRelativePath 含 /）
    const hasSubDirs = files.some(f => f.webkitRelativePath?.includes('/'))

    if (hasSubDirs) {
      // 收集需要创建的远程目录
      const dirs = new Set<string>()
      for (const file of files) {
        const rel = file.webkitRelativePath
        if (!rel) continue
        const parts = rel.split('/')
        // 逐级收集父目录
        for (let i = 1; i < parts.length; i++) {
          dirs.add(parts.slice(0, i).join('/'))
        }
      }
      // 按层级排序后逐个创建目录
      const sortedDirs = [...dirs].sort((a, b) => a.split('/').length - b.split('/').length)
      for (const dir of sortedDirs) {
        const remoteDirPath = currentPath === '/' ? `/${dir}` : `${currentPath}/${dir}`
        try { await sftp.mkdir(remoteDirPath) } catch { /* 目录可能已存在 */ }
      }
      // 上传文件到对应的远程子目录
      for (const file of files) {
        const rel = file.webkitRelativePath
        if (!rel) continue
        const parentDir = rel.substring(0, rel.lastIndexOf('/'))
        const remotePath = parentDir
          ? (currentPath === '/' ? `/${parentDir}` : `${currentPath}/${parentDir}`)
          : currentPath
        try {
          await uploadFiles(sftp.send, [file], remotePath)
        } catch { /* transfer-engine 已记录错误 */ }
      }
      sftp.refresh()
      addToast('success', `文件夹上传完成 (${files.length} 个文件)`)
    } else {
      try {
        await uploadFiles(sftp.send, files, currentPath)
        sftp.refresh()
        addToast('success', `${files.length} 个文件上传完成`)
      } catch (err) {
        addToast('error', `上传失败: ${(err as Error).message}`)
      }
    }
  }, [connected, sftp, addToast])
  // 双击文件 → 编辑
  const handleDoubleClick = useCallback((entry: SftpFileEntry) => {
    if (entry.type !== 'file') return
    actions.handleEdit(entry)
  }, [actions])

  // 编辑器保存
  const handleEditorSave = useCallback(async (content: string) => {
    if (!editorFile) return
    await sftp.writeFile(editorFile.path, content)
  }, [editorFile, sftp])

  return (
    <>
      <motion.div
        id="sftp-panel"
        className="shrink-0 border-l border-border flex flex-col bg-bg-card overflow-hidden"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 360, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={hidden ? { display: 'none' } : undefined}
      >
        <SftpNavBar
          onNavigate={actions.handleNavigate}
          onRefresh={sftp.refresh}
        />
        <SftpFileList
          onNavigate={actions.handleNavigate}
          onContextMenu={handleContextMenu}
          onBlankContextMenu={handleBlankContextMenu}
          onDoubleClick={handleDoubleClick}
          onFileDrop={handleFileDrop}
          onRename={actions.handleRenameSubmit}
          onCopy={actions.handleCopy}
          onCut={actions.handleCut}
          onPaste={actions.handlePaste}
          onDelete={actions.handleDelete}
          onRenameStart={actions.handleRename}
          onRefresh={sftp.refresh}
        />
        <SftpStatusBar />

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

      <SftpChmodModal
        isOpen={chmodTarget !== null}
        filePath={chmodTarget?.path ?? ''}
        currentMode={chmodTarget?.permissions ?? ''}
        isDir={chmodTarget?.isDir ?? false}
        onApply={(mode, recursive) => {
          if (chmodTarget) actions.handleChmod(chmodTarget.path, mode, recursive)
        }}
        onClose={() => setChmodTarget(null)}
      />
    </>
  )
}
