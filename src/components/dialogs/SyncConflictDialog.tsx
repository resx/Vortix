import { useState } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { useUIStore } from '../../stores/useUIStore'
import { useToastStore } from '../../stores/useToastStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useAssetStore } from '../../stores/useAssetStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import * as api from '../../api/client'

export default function SyncConflictDialog() {
  const open = useUIStore((s) => s.syncConflictOpen)
  const payload = useUIStore((s) => s.syncConflict)
  const close = useUIStore((s) => s.closeSyncConflict)
  const addToast = useToastStore((s) => s.addToast)
  const [resolving, setResolving] = useState(false)

  if (!open || !payload) return null

  const conflictReason = payload.info.reason === 'remote_ahead'
    ? '检测到远端版本领先，本地自动推送会覆盖远端数据。'
    : '检测到本地与远端同时有修改，请先确认冲突处理方式。'

  const conflictMeta = [
    `本地版本: ${payload.info.localRevision}`,
    `远端版本: ${payload.info.remoteRevision}`,
    payload.info.remoteExportedAt
      ? `远端时间: ${payload.info.remoteExportedAt.replace('T', ' ').slice(0, 19)}`
      : null,
  ].filter(Boolean).join(' · ')

  const handleUseRemote = async () => {
    if (resolving) return
    setResolving(true)
    try {
      const result = await api.syncImport(payload.body)
      await Promise.all([
        useSettingsStore.getState().loadSettings(),
        useAssetStore.getState().fetchAssets(),
        useShortcutStore.getState().fetchShortcuts(),
      ])
      addToast('success', `已使用远端版本: 目录${result.folders} 连接${result.connections} 快捷命令${result.shortcuts} 密钥${result.sshKeys}`)
      close()
    } catch (e) {
      addToast('error', `处理失败: ${(e as Error).message || '未知错误'}`)
    } finally {
      setResolving(false)
    }
  }

  const handleUseLocal = async () => {
    if (resolving) return
    setResolving(true)
    try {
      await api.syncExport(payload.body)
      addToast('success', '已使用本地版本覆盖远端')
      close()
    } catch (e) {
      addToast('error', `处理失败: ${(e as Error).message || '未知错误'}`)
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
      <div className="bg-bg-card rounded-xl shadow-2xl border border-border/60 w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="w-8 h-8 rounded-full bg-[#FF4D4F]/10 flex items-center justify-center shrink-0 mt-0.5">
            <AppIcon icon={icons.alertTriangle} size={16} className="text-status-error" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-text-1 mb-1">检测到同步冲突</div>
            <div className="text-[12px] text-text-2 leading-relaxed mb-1">{conflictReason}</div>
            <div className="text-[11px] text-text-3">{conflictMeta}</div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5">
          <button
            disabled={resolving}
            onClick={close}
            className="px-3.5 py-1.5 bg-bg-base text-text-2 rounded-lg text-[12px] font-medium hover:bg-border transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            disabled={resolving}
            onClick={handleUseRemote}
            className="px-3.5 py-1.5 bg-[#FF4D4F]/10 text-[#FF4D4F] rounded-lg text-[12px] font-medium hover:bg-[#FF4D4F]/20 transition-colors disabled:opacity-50"
          >
            使用远端
          </button>
          <button
            disabled={resolving}
            onClick={handleUseLocal}
            className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            使用本地
          </button>
        </div>
      </div>
    </div>
  )
}
