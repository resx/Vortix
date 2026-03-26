/* ── 同步快捷操作 Popover ── */

import { useState, useEffect } from 'react'
import { AppIcon, icons } from '../../../components/icons/AppIcon'
import { reloadStateAfterSyncImport } from '../../../hooks/useAppEffects'
import { useSettingsStore, buildSyncBody, isSyncConfigured } from '../../../stores/useSettingsStore'
import { useToastStore } from '../../../stores/useToastStore'
import { useUIStore } from '../../../stores/useUIStore'
import { openSettingsWindow } from '../../../lib/window'
import * as api from '../../../api/client'

const REPO_LABELS: Record<string, string> = {
  local: '本地文件', git: 'Git', webdav: 'WebDAV', s3: 'S3',
}

const formatSyncTime = (time: string | null | undefined): string => {
  if (!time) return '--'
  const parsed = new Date(time)
  if (Number.isNaN(parsed.getTime())) {
    const normalized = time.replace('T', ' ').replace('Z', '')
    return normalized.slice(0, 16)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

export default function SyncQuickPopover({ onClose }: { onClose: () => void }) {
  const repoSource = useSettingsStore((s) => s.syncRepoSource)
  const autoSync = useSettingsStore((s) => s.syncAutoSync)
  const addToast = useToastStore((s) => s.addToast)
  const syncRemoteAvailable = useUIStore((s) => s.syncRemoteAvailable)
  const setSyncRemoteAvailable = useUIStore((s) => s.setSyncRemoteAvailable)
  const localConfigured = useSettingsStore((s) => isSyncConfigured(s))
  const [syncing, setSyncing] = useState<'push' | 'pull' | null>(null)
  const [fileInfo, setFileInfo] = useState<{ exists: boolean; lastModified: string | null } | null>(null)
  const [isConfigured, setIsConfigured] = useState(localConfigured)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const info = await api.getSyncStatus(buildSyncBody())
        if (cancelled) return
        setFileInfo(info)
        setIsConfigured(true)
      } catch {
        if (cancelled) return
        setFileInfo(null)
        setIsConfigured(isSyncConfigured(useSettingsStore.getState()))
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [])

  const handlePush = async () => {
    setSyncing('push')
    try {
      const conflict = await api.checkPushConflict(buildSyncBody())
      if (conflict.hasConflict) {
        addToast('error', '检测到冲突，请前往同步设置处理')
        onClose(); return
      }
      await api.syncExport(buildSyncBody())
      setSyncRemoteAvailable(false)
      setFileInfo(await api.getSyncStatus(buildSyncBody()))
      addToast('success', '推送成功'); onClose()
    } catch (e) {
      addToast('error', (e as Error).message)
    } finally { setSyncing(null) }
  }

  const handlePull = async () => {
    setSyncing('pull')
    try {
      const conflict = await api.checkPullConflict(buildSyncBody())
      if (conflict.hasConflict) {
        addToast('error', '检测到冲突，请前往同步设置处理')
        onClose(); return
      }
      const result = await api.syncImport(buildSyncBody())
      addToast('success', `拉取成功：${result.folders} 文件夹、${result.connections} 连接、${result.shortcuts} 快捷命令、${result.sshKeys} 密钥`)
      await reloadStateAfterSyncImport('quick-sync-import')
      onClose()
    } catch (e) {
      addToast('error', (e as Error).message)
    } finally { setSyncing(null) }
  }

  const openSyncSettings = () => {
    openSettingsWindow('sync')
    onClose()
  }

  return (
    <div className="absolute right-0 top-full mt-[12px] w-[280px] bg-bg-card/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] rounded-xl border border-border z-[250] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-card/50">
        <div className="text-[13px] font-medium text-text-1 flex items-center gap-2">
          <AppIcon icon={icons.cloud} size={14} className="text-primary" />
          数据同步
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-block w-[6px] h-[6px] rounded-full ${isConfigured ? 'bg-chart-green' : 'bg-text-disabled'}`} />
          <span className="text-[11px] text-text-3">{REPO_LABELS[repoSource]}</span>
        </div>
      </div>

      {!isConfigured ? (
        <div className="flex flex-col items-center py-6 px-4">
          <AppIcon icon={icons.cloudOff} size={32} className="text-text-disabled mb-2" />
          <span className="text-[12px] text-text-3 mb-3">尚未配置同步源</span>
          <button onClick={openSyncSettings} className="px-3 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">前往配置</button>
        </div>
      ) : (
        <>
          <div className="px-4 py-2.5 text-[11px] text-text-3 border-b border-border/50">
            {fileInfo?.exists ? (
              <div className="flex items-center gap-1.5">
                <AppIcon icon={icons.checkCircle} size={12} className="text-chart-green" />
                <span>远端数据已同步</span>
                {fileInfo.lastModified && (
                  <span className="ml-auto text-text-disabled">{formatSyncTime(fileInfo.lastModified)}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <AppIcon icon={icons.cloudOff} size={12} />
                <span>远端暂无同步数据</span>
              </div>
            )}
            {autoSync && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <AppIcon icon={icons.refresh} size={11} className="text-primary" />
                <span className="text-primary">自动同步已开启</span>
              </div>
            )}
            {syncRemoteAvailable && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <AppIcon icon={icons.cloudArrowDown} size={11} className="text-[#FF4D4F]" />
                <span className="text-[#FF4D4F]">远端存在新配置，请拉取以保持一致</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            <button disabled={syncing !== null} onClick={handlePull} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-[7px] bg-bg-base text-text-1 rounded-lg text-[12px] font-medium hover:bg-border transition-colors disabled:opacity-50">
              {syncing === 'pull' ? <AppIcon icon={icons.loader} size={13} className="animate-spin" /> : <AppIcon icon={icons.cloudArrowDown} size={13} className="text-chart-green" />}
              拉取
            </button>
            <button disabled={syncing !== null} onClick={handlePush} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-[7px] bg-bg-base text-text-1 rounded-lg text-[12px] font-medium hover:bg-border transition-colors disabled:opacity-50">
              {syncing === 'push' ? <AppIcon icon={icons.loader} size={13} className="animate-spin" /> : <AppIcon icon={icons.cloudArrowUp} size={13} className="text-primary" />}
              推送
            </button>
          </div>
        </>
      )}

      <div className="px-4 py-2 border-t border-border/50 bg-bg-subtle/50">
        <button onClick={openSyncSettings} className="w-full flex items-center justify-center gap-1.5 text-[11px] text-text-3 hover:text-primary transition-colors py-0.5">
          <AppIcon icon={icons.settings} size={11} />
          同步设置
        </button>
      </div>
    </div>
  )
}
