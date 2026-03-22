import { useState, useEffect, useCallback, useMemo } from 'react'
import { SettingRow, SettingGroup } from './SettingGroup'
import { useSettingsStore, buildSyncBody, type SettingsState } from '../../stores/useSettingsStore'
import { useAssetStore } from '../../stores/useAssetStore'
import { useToastStore } from '../../stores/useToastStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { Switch } from '../ui/switch'
import { SettingsDropdown } from '../ui/select'
import * as api from '../../api/client'
import type { SyncFileInfo, ImportResult, SyncConflictInfo } from '../../api/types'
import { AppIcon, icons } from '../icons/AppIcon'
import KeyPickerModal from './KeyPickerModal'

type SyncConnectionState = 'idle' | 'ok' | 'error'

const formatSyncSize = (size: number | null): string => {
  if (size == null) return '--'
  if (size < 1024) return `${size} B`
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1048576).toFixed(2)} MB`
}

const formatSyncTime = (time: string | null): string => {
  if (!time) return '--'
  const normalized = time.replace('T', ' ').replace('Z', '')
  return normalized.slice(0, 16)
}

const SYNC_VERIFIED_SIGNATURE_HASH_KEY = 'vortix.sync.verifiedSignatureHash.v1'

const hashSyncSignature = (value: string): string => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

/* ── 仓库源显示名 ── */
const REPO_LABELS: Record<string, string> = {
  local: '本地文件', git: 'GIT', webdav: 'WEBDAV', s3: 'S3',
}

/* ── 数据加密密钥行 ── */
function EncryptionKeyRow() {
  const [visible, setVisible] = useState(false)
  const value = useSettingsStore((s) => s.syncEncryptionKey)
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <SettingRow label="数据加密密钥" desc="不填则使用内置密钥自动加密，填写后使用自定义密钥强加密">
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="island-btn w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-pointer transition-colors"
        >
          {visible ? <AppIcon icon={icons.eyeOff} size={13} className="text-text-2" /> : <AppIcon icon={icons.eye} size={13} className="text-text-2" />}
        </button>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => update('syncEncryptionKey', e.target.value)}
          placeholder="留空使用内置加密"
          className="island-control w-full max-w-[240px] px-2 text-[11px]"
        />
      </div>
    </SettingRow>
  )
}

/* ── TLS 验证行 ── */
function TlsToggleRow() {
  const value = useSettingsStore((s) => s.syncTlsVerify)
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <SettingRow label="TLS验证" desc="无有效 SSL 证书时请关闭">
      <Switch checked={value} onCheckedChange={() => update('syncTlsVerify', !value)} />
    </SettingRow>
  )
}

/* ── Git 认证类型推断 ── */
function useGitAuthType(url: string): 'ssh' | 'https' {
  return useMemo(() => {
    const u = url.trim().toLowerCase()
    if (u.startsWith('git@') || u.startsWith('ssh://')) return 'ssh'
    return 'https'
  }, [url])
}

/* ── 同步设置页主组件 ── */
export default function SyncSettings() {
  const update = useSettingsStore((s) => s.updateSetting)
  const repoSource = useSettingsStore((s) => s.syncRepoSource)
  const autoSync = useSettingsStore((s) => s.syncAutoSync)
  const syncLocalPath = useSettingsStore((s) => s.syncLocalPath)
  const gitUrl = useSettingsStore((s) => s.syncGitUrl)
  const gitBranch = useSettingsStore((s) => s.syncGitBranch)
  const gitPath = useSettingsStore((s) => s.syncGitPath)
  const gitUsername = useSettingsStore((s) => s.syncGitUsername)
  const gitPassword = useSettingsStore((s) => s.syncGitPassword)
  const gitSshKey = useSettingsStore((s) => s.syncGitSshKey)
  const syncGitSshKeyLabel = useSettingsStore((s) => s.syncGitSshKeyLabel)
  const syncGitSshKeyMode = useSettingsStore((s) => s.syncGitSshKeyMode)
  const webdavEndpoint = useSettingsStore((s) => s.syncWebdavEndpoint)
  const webdavPath = useSettingsStore((s) => s.syncWebdavPath)
  const webdavUsername = useSettingsStore((s) => s.syncWebdavUsername)
  const webdavPassword = useSettingsStore((s) => s.syncWebdavPassword)
  const s3Style = useSettingsStore((s) => s.syncS3Style)
  const s3Endpoint = useSettingsStore((s) => s.syncS3Endpoint)
  const s3Path = useSettingsStore((s) => s.syncS3Path)
  const s3Region = useSettingsStore((s) => s.syncS3Region)
  const s3Bucket = useSettingsStore((s) => s.syncS3Bucket)
  const s3AccessKey = useSettingsStore((s) => s.syncS3AccessKey)
  const s3SecretKey = useSettingsStore((s) => s.syncS3SecretKey)
  const gitAuthType = useGitAuthType(gitUrl)

  // 操作状态
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const addToast = useToastStore((s) => s.addToast)
  const [fileInfo, setFileInfo] = useState<SyncFileInfo | null>(null)
  const [connectionState, setConnectionState] = useState<SyncConnectionState>('idle')
  const [connectionHint, setConnectionHint] = useState('')
  const [confirmImport, setConfirmImport] = useState(false)
  const [confirmExport, setConfirmExport] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteRemote, setConfirmDeleteRemote] = useState(false)
  const [conflictInfo, setConflictInfo] = useState<{ info: SyncConflictInfo; action: 'push' | 'pull' } | null>(null)
  const [pickingDir, setPickingDir] = useState(false)
  const [showKeyPicker, setShowKeyPicker] = useState(false)
  const [manualKeyVisible, setManualKeyVisible] = useState(false)
  const syncBody = buildSyncBody()

  // 使用共享的 buildSyncBody 工具函数

  /* 刷新同步文件状态（所有源） */
  const hasManagerBinding = Boolean(syncGitSshKeyLabel && gitSshKey.trim())

  useEffect(() => {
    if (hasManagerBinding && syncGitSshKeyMode !== 'manager') {
      update('syncGitSshKeyMode', 'manager')
      return
    }
    if (!syncGitSshKeyLabel && gitSshKey.trim() && syncGitSshKeyMode !== 'manual') {
      update('syncGitSshKeyMode', 'manual')
    }
  }, [gitSshKey, hasManagerBinding, syncGitSshKeyLabel, syncGitSshKeyMode, update])

  const maskedGitSshKey = useMemo(() => {
    if (!gitSshKey) return ''
    return gitSshKey.replace(/[^\r\n]/g, '•')
  }, [gitSshKey])

  const configSignature = useMemo(() => {
    if (repoSource === 'local') return `local|${syncLocalPath}`
    if (repoSource === 'git') {
      if (gitAuthType === 'ssh') {
        return `git|ssh|${gitUrl}|${gitBranch}|${gitPath}|${gitSshKey}|${syncGitSshKeyLabel}|${syncGitSshKeyMode}`
      }
      return `git|https|${gitUrl}|${gitBranch}|${gitPath}|${gitUsername}|${gitPassword}`
    }
    if (repoSource === 'webdav') return `webdav|${webdavEndpoint}|${webdavPath}|${webdavUsername}|${webdavPassword}`
    return `s3|${s3Style}|${s3Endpoint}|${s3Path}|${s3Region}|${s3Bucket}|${s3AccessKey}|${s3SecretKey}`
  }, [
    repoSource, syncLocalPath, gitAuthType, gitUrl, gitBranch, gitPath, gitSshKey, syncGitSshKeyLabel, syncGitSshKeyMode,
    gitUsername, gitPassword, webdavEndpoint, webdavPath, webdavUsername, webdavPassword,
    s3Style, s3Endpoint, s3Path, s3Region, s3Bucket, s3AccessKey, s3SecretKey,
  ])

  const configSignatureHash = useMemo(() => hashSyncSignature(configSignature), [configSignature])

  const persistVerifiedSignature = useCallback((verified: boolean) => {
    try {
      if (verified) {
        window.localStorage.setItem(SYNC_VERIFIED_SIGNATURE_HASH_KEY, configSignatureHash)
        return
      }
      if (window.localStorage.getItem(SYNC_VERIFIED_SIGNATURE_HASH_KEY) === configSignatureHash) {
        window.localStorage.removeItem(SYNC_VERIFIED_SIGNATURE_HASH_KEY)
      }
    } catch {
      // ignore localStorage failures in restricted environments
    }
  }, [configSignatureHash])

  useEffect(() => {
    setConnectionHint('')
    setFileInfo(null)
    let isVerified = false
    try {
      isVerified = window.localStorage.getItem(SYNC_VERIFIED_SIGNATURE_HASH_KEY) === configSignatureHash
    } catch {
      isVerified = false
    }
    setConnectionState(isVerified ? 'ok' : 'idle')
  }, [configSignatureHash])

  const refreshFileInfo = useCallback(async (): Promise<boolean> => {
    if (repoSource === 'local' && !syncLocalPath.trim()) { setFileInfo(null); return false }
    if (repoSource === 'git' && !gitUrl.trim()) { setFileInfo(null); return false }
    if (repoSource === 'webdav' && !webdavEndpoint.trim()) { setFileInfo(null); return false }
    if (repoSource === 's3' && (!s3Endpoint.trim() || !s3Bucket.trim() || !s3AccessKey.trim() || !s3SecretKey.trim())) {
      setFileInfo(null)
      return false
    }
    try {
      const info = await api.getSyncStatus(syncBody)
      setFileInfo(info)
      return true
    } catch {
      setFileInfo(null)
      return false
    }
  }, [gitUrl, repoSource, s3AccessKey, s3Bucket, s3Endpoint, s3SecretKey, syncBody, syncLocalPath, webdavEndpoint])

  useEffect(() => {
    if (connectionState !== 'ok') return
    void refreshFileInfo()
  }, [connectionState, refreshFileInfo])

  const handleTest = async () => {
    if (repoSource === 'local' && !syncLocalPath.trim()) {
      addToast('error', '请选择同步路径'); return
    }
    if (repoSource === 'git' && !gitUrl.trim()) {
      addToast('error', '请填写仓库地址'); return
    }
    if (repoSource === 'webdav' && !webdavEndpoint.trim()) {
      addToast('error', '请填写 WebDAV Endpoint'); return
    }
    if (repoSource === 's3' && !s3Endpoint.trim()) {
      addToast('error', '请填写 S3 Endpoint'); return
    }
    setTesting(true)
    setConnectionHint('')
    try {
      await api.syncTest(syncBody)
      setConnectionState('ok')
      persistVerifiedSignature(true)
      addToast('success', repoSource === 'local' ? '路径检查成功' : '连接测试成功')
      const statusOk = await refreshFileInfo()
      if (!statusOk) setConnectionHint('连接成功，但远端状态获取失败，可继续拉取或推送')
    } catch (e) {
      setConnectionState('error')
      setFileInfo(null)
      persistVerifiedSignature(false)
      setConnectionHint((e as Error).message)
      addToast('error', (e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  /* 导出（推送前检测冲突） */
  const handleExport = async (force = false) => {
    if (connectionState !== 'ok') {
      addToast('error', '请先测试连接')
      return
    }
    if (repoSource === 'local' && !syncLocalPath.trim()) {
      addToast('error', '请填写同步路径'); return
    }
    setSyncing(true)
    setConnectionHint('')
    try {
      // 非强制推送时先检测冲突
      if (!force) {
        const conflict = await api.checkPushConflict(syncBody)
        if (conflict.hasConflict) {
          setConflictInfo({ info: conflict, action: 'push' })
          setSyncing(false)
          return
        }
      }
      await api.syncExport(syncBody)
      setConnectionState('ok')
      addToast('success', '推送成功')
      await refreshFileInfo()
    } catch (e) {
      setConnectionState('error')
      setConnectionHint((e as Error).message)
      addToast('error', (e as Error).message)
    } finally { setSyncing(false) }
  }

  /* 导入（拉取前检测冲突） */
  const handleImport = async (force = false) => {
    if (connectionState !== 'ok') {
      addToast('error', '请先测试连接')
      return
    }
    if (repoSource === 'local' && !syncLocalPath.trim()) {
      addToast('error', '请填写同步路径'); return
    }
    setSyncing(true); setConfirmImport(false)
    setConnectionHint('')
    try {
      // 非强制拉取时先检测冲突
      if (!force) {
        const conflict = await api.checkPullConflict(syncBody)
        if (conflict.hasConflict) {
          setConflictInfo({ info: conflict, action: 'pull' })
          setSyncing(false)
          return
        }
      }
      const result: ImportResult = await api.syncImport(syncBody)
      setConnectionState('ok')
      addToast('success', `拉取成功：${result.folders} 个文件夹、${result.connections} 个连接、${result.shortcuts} 个快捷命令、${result.sshKeys} 个密钥`)
      await Promise.all([
        useSettingsStore.getState().loadSettings(),
        useAssetStore.getState().fetchAssets(),
        useShortcutStore.getState().fetchShortcuts(),
      ])
      await refreshFileInfo()
    } catch (e) {
      setConnectionState('error')
      setConnectionHint((e as Error).message)
      addToast('error', (e as Error).message)
    } finally { setSyncing(false) }
  }

  /* 冲突解决：使用本地数据（强制推送） */
  const handleConflictUseLocal = () => {
    setConflictInfo(null)
    handleExport(true)
  }

  /* 冲突解决：使用远端数据（强制拉取） */
  const handleConflictUseRemote = () => {
    setConflictInfo(null)
    handleImport(true)
  }

  /* 删除远端同步文件 */
  const handleDeleteRemote = async () => {
    setSyncing(true); setConfirmDeleteRemote(false)
    setConnectionHint('')
    try {
      await api.deleteSyncRemote(syncBody)
      setConnectionState('ok')
      addToast('success', repoSource === 'local' ? '本地同步文件已清理' : '远端同步数据已删除')
      await refreshFileInfo()
    } catch (e) {
      setConnectionState('error')
      setConnectionHint((e as Error).message)
      addToast('error', (e as Error).message)
    } finally { setSyncing(false) }
  }

  /* 连通性测试 */
  /* 通用输入框样式 */
  const inputCls = "island-control px-2 text-[11px] placeholder-text-disabled shrink min-w-0"
  const smallIslandBtn = 'island-btn h-[26px] px-2.5 text-[11px] text-text-2 inline-flex items-center justify-center transition-colors'
  const syncActionsEnabled = connectionState === 'ok' && !syncing && !testing
  const preferPull = connectionState === 'ok' && fileInfo?.exists === true
  const preferPush = connectionState === 'ok' && fileInfo?.exists === false

  const syncHintText = useMemo(() => {
    if (connectionState === 'idle') return '请先测试连接，成功后再拉取或推送。'
    if (connectionState === 'error') return connectionHint || '连接失败，请检查地址或凭据后重试。'
    if (fileInfo?.exists) {
      const when = formatSyncTime(fileInfo.lastModified)
      const size = formatSyncSize(fileInfo.size)
      return `☁️ 远端存在备份（更新于 ${when}，${size}）`
    }
    if (fileInfo && !fileInfo.exists) return '☁️ 远端仓库为空，随时可推送。'
    return connectionHint || '连接成功，可执行拉取或推送。'
  }, [connectionHint, connectionState, fileInfo])

  return (
    <>
      <div className="text-[16px] font-medium text-text-1 mb-3">数据同步</div>

      {/* ── 岛屿 1：资产同步基础 ── */}
      <SettingGroup>
        <SettingRow label="本地数据">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-3 truncate">此操作将导致本地连接/配置完全清空</span>
            {confirmClear ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => { setConfirmClear(false) }}
                  className={`${smallIslandBtn} px-2`}
                >取消</button>
                <button
                  onClick={async () => {
                    try {
                      await api.purgeAllData()
                      await useAssetStore.getState().fetchAssets()
                      await useShortcutStore.getState().fetchShortcuts()
                      addToast('success', '本地数据已清除')
                    } catch (e) { addToast('error', (e as Error).message) }
                    setConfirmClear(false)
                  }}
                  className="h-[26px] px-2 rounded-lg border border-status-error/30 bg-status-error/10 text-status-error text-[11px] font-medium hover:bg-status-error/20 transition-colors"
                >确认清除</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className={`${smallIslandBtn} shrink-0`}
              >清除本地数据</button>
            )}
          </div>
        </SettingRow>

        <SettingRow label="云端同步">
          <div className="flex min-w-0 flex-col items-end gap-1.5">
            <div className="flex gap-1.5 shrink-0">
              <button
                disabled={syncing || testing}
                onClick={handleTest}
                className={`${smallIslandBtn} gap-1 disabled:opacity-50 ${connectionState === 'idle' ? 'border-primary/40 bg-primary/10 text-primary' : ''}`}
              >
                {testing ? <AppIcon icon={icons.loader} size={11} className="animate-spin" /> : <AppIcon icon={icons.cloudCog} size={11} />}
                {testing ? '测试中...' : (repoSource === 'local' ? '检查路径' : '测试连接')}
              </button>
              <button
                disabled={!syncActionsEnabled}
                onClick={() => setConfirmImport(true)}
                className={`${smallIslandBtn} gap-1 disabled:opacity-50 ${preferPull ? 'border-primary/40 bg-primary/10 text-primary' : ''}`}
              >
                {syncing ? <AppIcon icon={icons.loader} size={11} className="animate-spin" /> : <AppIcon icon={icons.download} size={11} />}
                拉取
              </button>
              <button
                disabled={!syncActionsEnabled}
                onClick={() => {
                  if (fileInfo?.exists) setConfirmExport(true)
                  else handleExport()
                }}
                className={`${smallIslandBtn} gap-1 disabled:opacity-50 ${preferPush ? 'border-primary/40 bg-primary/10 text-primary' : ''}`}
              >
                {syncing ? <AppIcon icon={icons.loader} size={11} className="animate-spin" /> : <AppIcon icon={icons.upload} size={11} />}
                推送
              </button>
            </div>
            <div className={`max-w-[420px] text-[12px] leading-[1.4] text-right ${connectionState === 'error' ? 'text-status-error' : 'text-text-3'}`}>
              {syncHintText}
            </div>
            <div className="text-[11px] text-text-3/80">ⓘ 同步内容会加密后写入远端。</div>
          </div>
        </SettingRow>

        <SettingRow label={repoSource === 'local' ? '清理同步文件' : '私有云端资产'}>
          {confirmDeleteRemote ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setConfirmDeleteRemote(false)}
                className={`${smallIslandBtn} px-2`}
              >取消</button>
              <button
                disabled={syncing}
                onClick={handleDeleteRemote}
                className="h-[26px] px-2 rounded-lg border border-status-error/30 bg-status-error/10 text-status-error text-[11px] font-medium hover:bg-status-error/20 transition-colors disabled:opacity-50"
              >{repoSource === 'local' ? '确认清理' : '确认删除'}</button>
            </div>
          ) : (
            <button
              disabled={syncing}
              onClick={() => setConfirmDeleteRemote(true)}
              className={`${smallIslandBtn} shrink-0 disabled:opacity-50`}
            >
              {repoSource === 'local' ? '清理本地同步文件' : `删除 ${REPO_LABELS[repoSource]} 仓库资产`}
            </button>
          )}
        </SettingRow>

        {repoSource !== 'local' && (
          <SettingRow label="自动同步" desc="新建资产时将自动进行同步">
            <Switch checked={autoSync} onCheckedChange={() => update('syncAutoSync', !autoSync)} />
          </SettingRow>
        )}

        <SettingRow label="仓库源">
          <div className="flex items-center gap-2">
            {repoSource === 'local' && (
              <span className="text-[11px] text-text-3 truncate">注：无法使用网盘/OneDrive挂载文件进行资产同步</span>
            )}
            <SettingsDropdown
              value={repoSource}
              options={[
                { value: 'local', label: '本地文件' },
                { value: 'git', label: 'Git' },
                { value: 'webdav', label: 'WebDAV' },
                { value: 's3', label: 'S3' },
              ]}
              onChange={(v) => update('syncRepoSource', v as SettingsState['syncRepoSource'])}
              width="w-[120px]"
            />
          </div>
        </SettingRow>
      </SettingGroup>

      {/* ── 岛屿 2：动态仓库源配置 ── */}
      <div className="mt-5">
        <div className="text-[14px] font-medium text-text-1 mb-3">
          {repoSource === 'git' ? 'Git' : repoSource === 'webdav' ? 'WebDAV' : repoSource === 's3' ? 'S3' : '本地文件'}
        </div>
        <SettingGroup>
          {/* ── 本地文件 ── */}
          {repoSource === 'local' && (
            <>
              <SettingRow label="路径">
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={pickingDir}
                    onClick={async () => {
                      setPickingDir(true)
                      try {
                        const selected = await api.pickDir(syncLocalPath || undefined)
                        if (selected) update('syncLocalPath', selected)
                      } catch { /* 静默 */ }
                      setPickingDir(false)
                    }}
                    className={`island-btn w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-pointer transition-colors ${pickingDir ? 'animate-pulse' : ''}`}
                  >
                    <AppIcon icon={icons.folder} size={13} className="text-text-2" />
                  </button>
                  <input
                    type="text"
                    value={syncLocalPath}
                    onChange={(e) => update('syncLocalPath', e.target.value)}
                    placeholder="选择或输入同步目录"
                    className={`${inputCls} w-full max-w-[280px]`}
                  />
                </div>
              </SettingRow>
              <EncryptionKeyRow />
            </>
          )}

          {/* ── Git ── */}
          {repoSource === 'git' && (
            <div className="sync-provider-grid">
              <SettingRow label="仓库地址">
                <input
                  type="text"
                  value={gitUrl}
                  onChange={(e) => update('syncGitUrl', e.target.value)}
                  placeholder="https:// 或 git@"
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="分支">
                <input
                  type="text"
                  value={gitBranch}
                  onChange={(e) => update('syncGitBranch', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="存储路径" desc="留空则写入仓库根目录；可指定子目录，如 Vortix 或 backup/vortix">
                <input
                  type="text"
                  value={gitPath}
                  onChange={(e) => update('syncGitPath', e.target.value)}
                  placeholder="仓库内相对子目录，可留空"
                  className={`${inputCls} w-full max-w-[360px] font-mono`}
                />
              </SettingRow>
              {gitAuthType === 'https' ? (
                <>
                  <SettingRow label="用户名">
                    <input
                      type="text"
                      value={gitUsername}
                      onChange={(e) => update('syncGitUsername', e.target.value)}
                      className={`${inputCls} w-full max-w-[360px]`}
                    />
                  </SettingRow>
                  <SettingRow label="密码/Token" desc="建议使用 Personal Access Token">
                    <input
                      type="password"
                      value={gitPassword}
                      onChange={(e) => update('syncGitPassword', e.target.value)}
                      className={`${inputCls} w-full max-w-[360px]`}
                    />
                  </SettingRow>
                  <TlsToggleRow />
                </>
              ) : (
                <SettingRow label="SSH私钥">
                  <div className="island-surface w-full max-w-[460px] rounded-2xl p-2">
                    <div className="flex items-center justify-between gap-2 px-1 pb-2">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-bg-base/70 px-2 py-0.5 text-[10px] font-medium tracking-[0.02em] text-text-2">
                        <AppIcon icon={icons.shield} size={11} className="text-primary" />
                        <span>SSH 私钥</span>
                      </div>
                      <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="从本地文件导入私钥"
                      onClick={async () => {
                        try {
                          const result = await api.pickFile('选择 SSH 私钥文件', '私钥文件|*.pem;*.key;*.ppk;*.pub|所有文件|*.*')
                          if (result.content) {
                            update('syncGitSshKey', result.content.trim())
                            update('syncGitSshKeyLabel', '')
                            update('syncGitSshKeyMode', 'manual')
                          }
                        } catch { /* 静默 */ }
                      }}
                      className="island-btn w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <AppIcon icon={icons.fileText} size={13} className="text-text-2" />
                    </button>
                    <button
                      type="button"
                      title="选择已配置的连接私钥"
                      onClick={() => setShowKeyPicker(true)}
                      className="island-btn w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <AppIcon icon={icons.key} size={13} className="text-text-2" />
                    </button>
                    {syncGitSshKeyMode === 'manual' && (
                      <button
                        type="button"
                        title={manualKeyVisible ? '隐藏私钥' : '显示私钥'}
                        onClick={() => setManualKeyVisible((v) => !v)}
                        className="island-btn w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <AppIcon icon={manualKeyVisible ? icons.eyeOff : icons.eye} size={13} className="text-text-2" />
                      </button>
                    )}
                      </div>
                    </div>
                    {syncGitSshKeyMode === 'manager' ? (
                      hasManagerBinding ? (
                        <div className="island-surface rounded-xl px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[11px] text-text-3">已选择密钥</div>
                              <div className="text-[12px] text-text-1 font-medium truncate">{syncGitSshKeyLabel}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setShowKeyPicker(true)}
                                className={`${smallIslandBtn}`}
                              >
                                更换密钥
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  update('syncGitSshKey', '')
                                  update('syncGitSshKeyLabel', '')
                                  update('syncGitSshKeyMode', 'manager')
                                }}
                                className={`${smallIslandBtn}`}
                              >
                                解除绑定
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  update('syncGitSshKey', '')
                                  update('syncGitSshKeyLabel', '')
                                  update('syncGitSshKeyMode', 'manual')
                                }}
                                className={`${smallIslandBtn}`}
                              >
                                手动输入
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/80 bg-bg-card/70 px-3 py-3">
                          <div className="text-[12px] text-text-2 mb-2">未选择密钥</div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setShowKeyPicker(true)}
                              className={`${smallIslandBtn}`}
                            >
                              选择密钥管理器
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                update('syncGitSshKey', '')
                                update('syncGitSshKeyLabel', '')
                                update('syncGitSshKeyMode', 'manual')
                              }}
                              className={`${smallIslandBtn}`}
                            >
                              手动输入
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={manualKeyVisible ? gitSshKey : maskedGitSshKey}
                          onChange={(e) => {
                            if (!manualKeyVisible) return
                            update('syncGitSshKey', e.target.value)
                            update('syncGitSshKeyLabel', '')
                            update('syncGitSshKeyMode', 'manual')
                          }}
                          readOnly={!manualKeyVisible}
                          placeholder={`-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----`}
                          spellCheck={false}
                          rows={6}
                          className={`w-full min-h-[118px] max-h-[280px] resize-y rounded-xl border border-border/70 bg-bg-card/90 px-3 py-2 font-mono text-[11px] leading-[1.5] outline-none transition-[border-color,box-shadow] whitespace-pre-wrap break-all overflow-y-auto overflow-x-hidden sync-key-scrollbar ${
                            manualKeyVisible
                              ? 'text-text-1 focus:border-primary/60 focus:shadow-[0_0_0_3px_rgba(64,128,255,0.14)]'
                              : 'text-text-3 cursor-default select-none'
                          }`}
                        />
                      </div>
                    )}
                    <div className="px-1 pt-1.5 text-[10px] text-text-3">
                      支持 OpenSSH / PEM 私钥，建议从本地文件导入，避免粘贴格式错误。
                    </div>
                  </div>
                </SettingRow>
              )}
              <EncryptionKeyRow />
            </div>
          )}

          {/* ── WebDAV ── */}
          {repoSource === 'webdav' && (
            <div className="sync-provider-grid">
              <SettingRow label="Endpoint">
                <input
                  type="text"
                  value={webdavEndpoint}
                  onChange={(e) => update('syncWebdavEndpoint', e.target.value)}
                  placeholder="http://webdav.com"
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="路径">
                <input
                  type="text"
                  value={webdavPath}
                  onChange={(e) => update('syncWebdavPath', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="用户名">
                <input
                  type="text"
                  value={webdavUsername}
                  onChange={(e) => update('syncWebdavUsername', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="密码">
                <input
                  type="password"
                  value={webdavPassword}
                  onChange={(e) => update('syncWebdavPassword', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <EncryptionKeyRow />
              <TlsToggleRow />
            </div>
          )}

          {/* ── S3 ── */}
          {repoSource === 's3' && (
            <div className="sync-provider-grid">
              <SettingRow label="Addressing Style">
                <SettingsDropdown
                  value={s3Style}
                  options={[
                    { value: 'virtual-hosted', label: 'Virtual-Hosted Style' },
                    { value: 'path', label: 'Path Style' },
                  ]}
                  onChange={(v) => update('syncS3Style', v)}
                  width="w-[220px]"
                  triggerWidth="w-[360px] max-w-full"
                />
              </SettingRow>
              <SettingRow label="Endpoint">
                <input
                  type="text"
                  value={s3Endpoint}
                  onChange={(e) => update('syncS3Endpoint', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="路径">
                <input
                  type="text"
                  value={s3Path}
                  onChange={(e) => update('syncS3Path', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="Region">
                <input
                  type="text"
                  value={s3Region}
                  onChange={(e) => update('syncS3Region', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="Bucket">
                <input
                  type="text"
                  value={s3Bucket}
                  onChange={(e) => update('syncS3Bucket', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="AccessKey">
                <input
                  type="text"
                  value={s3AccessKey}
                  onChange={(e) => update('syncS3AccessKey', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <SettingRow label="SecretAccessKey">
                <input
                  type="password"
                  value={s3SecretKey}
                  onChange={(e) => update('syncS3SecretKey', e.target.value)}
                  className={`${inputCls} w-full max-w-[360px]`}
                />
              </SettingRow>
              <EncryptionKeyRow />
              <TlsToggleRow />
            </div>
          )}

        </SettingGroup>
      </div>

      {/* 同步文件状态 */}
      

      {/* 导入确认弹窗 */}
      {confirmImport && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="island-surface rounded-xl w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="flex items-start gap-3 px-5 pt-5 pb-3">
              <div className="w-8 h-8 rounded-full bg-[#FFD666]/15 flex items-center justify-center shrink-0 mt-0.5">
                <AppIcon icon={icons.alertTriangle} size={16} className="text-[#E6A23C]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-text-1 mb-1">确认拉取？</div>
                <div className="text-[12px] text-text-2 leading-relaxed">拉取将覆盖所有本地数据（连接、文件夹、设置、快捷命令）。当前数据库已自动备份。</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5">
              <button onClick={() => setConfirmImport(false)} className="island-btn px-3.5 py-1.5 text-text-2 rounded-lg text-[12px] font-medium transition-colors">取消</button>
              <button onClick={() => handleImport()} className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">确认拉取</button>
            </div>
          </div>
        </div>
      )}

      {/* 推送确认弹窗 */}
      {confirmExport && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="island-surface rounded-xl w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="flex items-start gap-3 px-5 pt-5 pb-3">
              <div className="w-8 h-8 rounded-full bg-[#FFD666]/15 flex items-center justify-center shrink-0 mt-0.5">
                <AppIcon icon={icons.alertTriangle} size={16} className="text-[#E6A23C]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-text-1 mb-1">确认推送？</div>
                <div className="text-[12px] text-text-2 leading-relaxed">远端已存在同步数据，推送将覆盖远端数据。请确认本地数据是最新的。</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5">
              <button onClick={() => setConfirmExport(false)} className="island-btn px-3.5 py-1.5 text-text-2 rounded-lg text-[12px] font-medium transition-colors">取消</button>
              <button onClick={() => { setConfirmExport(false); handleExport() }} className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">确认推送</button>
            </div>
          </div>
        </div>
      )}

      {/* 冲突检测弹窗 */}
      {conflictInfo && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="island-surface rounded-xl w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="flex items-start gap-3 px-5 pt-5 pb-3">
              <div className="w-8 h-8 rounded-full bg-[#FF4D4F]/10 flex items-center justify-center shrink-0 mt-0.5">
                <AppIcon icon={icons.alertTriangle} size={16} className="text-status-error" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-text-1 mb-1">检测到同步冲突</div>
                <div className="text-[12px] text-text-2 leading-relaxed mb-1">
                  {conflictInfo.info.reason === 'remote_ahead'
                    ? '远端数据版本高于本地，其他设备可能已推送了更新。'
                    : '本地有未同步的变更，且远端也有更新。'}
                </div>
                <div className="text-[11px] text-text-3">
                  本地版本: {conflictInfo.info.localRevision} · 远端版本: {conflictInfo.info.remoteRevision}
                  {conflictInfo.info.remoteExportedAt && ` · 远端更新于: ${conflictInfo.info.remoteExportedAt.replace('T', ' ').slice(0, 19)}`}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5">
              <button onClick={() => setConflictInfo(null)} className="island-btn px-3.5 py-1.5 text-text-2 rounded-lg text-[12px] font-medium transition-colors">取消</button>
              <button onClick={handleConflictUseRemote} className="px-3.5 py-1.5 bg-[#FF4D4F]/10 text-[#FF4D4F] rounded-lg text-[12px] font-medium hover:bg-[#FF4D4F]/20 transition-colors">使用远端数据</button>
              <button onClick={handleConflictUseLocal} className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">使用本地数据</button>
            </div>
          </div>
        </div>
      )}

      {/* 安全提示 */}
      

      {/* 私钥选择弹窗 */}
      {showKeyPicker && (
        <KeyPickerModal
          onSelect={(key, meta) => {
            update('syncGitSshKey', key)
            update('syncGitSshKeyLabel', meta?.keyName ?? '')
            update('syncGitSshKeyMode', 'manager')
          }}
          onClose={() => setShowKeyPicker(false)}
        />
      )}
    </>
  )
}
