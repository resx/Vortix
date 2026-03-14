import { useState, useEffect, useCallback, useMemo } from 'react'
import { SettingRow, SettingGroup } from './SettingGroup'
import { useSettingsStore, type SettingsState } from '../../stores/useSettingsStore'
import { useAssetStore } from '../../stores/useAssetStore'
import { useToastStore } from '../../stores/useToastStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { Switch } from '../ui/switch'
import { SettingsDropdown } from '../ui/select'
import * as api from '../../api/client'
import type { SyncFileInfo, ImportResult, SyncConflictInfo, SyncRequestBody } from '../../api/types'
import { AppIcon, icons } from '../icons/AppIcon'
import KeyPickerModal from './KeyPickerModal'

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
          className="w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors"
        >
          {visible ? <AppIcon icon={icons.eyeOff} size={13} className="text-text-2" /> : <AppIcon icon={icons.eye} size={13} className="text-text-2" />}
        </button>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => update('syncEncryptionKey', e.target.value)}
          placeholder="留空使用内置加密"
          className="w-full max-w-[240px] h-[26px] border border-border bg-bg-card rounded px-2 text-[11px] text-text-1 outline-none"
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
  const syncEncryptionKey = useSettingsStore((s) => s.syncEncryptionKey)
  const syncLocalPath = useSettingsStore((s) => s.syncLocalPath)
  const syncTlsVerify = useSettingsStore((s) => s.syncTlsVerify)
  const gitUrl = useSettingsStore((s) => s.syncGitUrl)
  const gitBranch = useSettingsStore((s) => s.syncGitBranch)
  const gitPath = useSettingsStore((s) => s.syncGitPath)
  const gitUsername = useSettingsStore((s) => s.syncGitUsername)
  const gitPassword = useSettingsStore((s) => s.syncGitPassword)
  const gitSshKey = useSettingsStore((s) => s.syncGitSshKey)
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
  const [confirmImport, setConfirmImport] = useState(false)
  const [confirmExport, setConfirmExport] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteRemote, setConfirmDeleteRemote] = useState(false)
  const [conflictInfo, setConflictInfo] = useState<{ info: SyncConflictInfo; action: 'push' | 'pull' } | null>(null)
  const [pickingDir, setPickingDir] = useState(false)
  const [showKeyPicker, setShowKeyPicker] = useState(false)
  const syncBody = useMemo<SyncRequestBody>(() => ({
    repoSource,
    encryptionKey: syncEncryptionKey || undefined,
    syncLocalPath: syncLocalPath ?? '',
    syncTlsVerify,
    syncGitUrl: gitUrl ?? '',
    syncGitBranch: gitBranch ?? 'master',
    syncGitPath: gitPath ?? '',
    syncGitUsername: gitUsername ?? '',
    syncGitPassword: gitPassword ?? '',
    syncGitSshKey: gitSshKey ?? '',
    syncWebdavEndpoint: webdavEndpoint ?? '',
    syncWebdavPath: webdavPath ?? 'vortix',
    syncWebdavUsername: webdavUsername ?? '',
    syncWebdavPassword: webdavPassword ?? '',
    syncS3Style: s3Style ?? 'virtual-hosted',
    syncS3Endpoint: s3Endpoint ?? '',
    syncS3Path: s3Path ?? 'vortix',
    syncS3Region: s3Region ?? 'ap-east-1',
    syncS3Bucket: s3Bucket ?? '',
    syncS3AccessKey: s3AccessKey ?? '',
    syncS3SecretKey: s3SecretKey ?? '',
  }), [
    gitBranch,
    gitPassword,
    gitPath,
    gitSshKey,
    gitUrl,
    gitUsername,
    repoSource,
    s3AccessKey,
    s3Bucket,
    s3Endpoint,
    s3Path,
    s3Region,
    s3SecretKey,
    s3Style,
    syncEncryptionKey,
    syncLocalPath,
    syncTlsVerify,
    webdavEndpoint,
    webdavPassword,
    webdavPath,
    webdavUsername,
  ])

  // 使用共享的 buildSyncBody 工具函数

  /* 刷新同步文件状态（所有源） */
  const refreshFileInfo = useCallback(async () => {
    if (repoSource === 'local' && !syncLocalPath.trim()) { setFileInfo(null); return }
    if (repoSource === 'git' && !gitUrl.trim()) { setFileInfo(null); return }
    if (repoSource === 'webdav' && !webdavEndpoint.trim()) { setFileInfo(null); return }
    if (repoSource === 's3' && !s3Endpoint.trim()) { setFileInfo(null); return }
    try {
      const info = await api.getSyncStatus(syncBody)
      setFileInfo(info)
    } catch { setFileInfo(null) }
  }, [gitUrl, repoSource, s3Endpoint, syncBody, syncLocalPath, webdavEndpoint])

  useEffect(() => { refreshFileInfo() }, [refreshFileInfo])

  /* 导出（推送前检测冲突） */
  const handleExport = async (force = false) => {
    if (repoSource === 'local' && !syncLocalPath.trim()) {
      addToast('error', '请填写同步路径'); return
    }
    setSyncing(true)
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
      addToast('success', '推送成功')
      await refreshFileInfo()
    } catch (e) {
      addToast('error', (e as Error).message)
    } finally { setSyncing(false) }
  }

  /* 导入（拉取前检测冲突） */
  const handleImport = async (force = false) => {
    if (repoSource === 'local' && !syncLocalPath.trim()) {
      addToast('error', '请填写同步路径'); return
    }
    setSyncing(true); setConfirmImport(false)
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
      addToast('success', `拉取成功：${result.folders} 个文件夹、${result.connections} 个连接、${result.shortcuts} 个快捷命令、${result.sshKeys} 个密钥`)
      await Promise.all([
        useSettingsStore.getState().loadSettings(),
        useAssetStore.getState().fetchAssets(),
        useShortcutStore.getState().fetchShortcuts(),
      ])
      await refreshFileInfo()
    } catch (e) {
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
    try {
      await api.deleteSyncRemote(syncBody)
      addToast('success', '远端同步数据已删除')
      await refreshFileInfo()
    } catch (e) {
      addToast('error', (e as Error).message)
    } finally { setSyncing(false) }
  }

  /* 连通性测试 */
  const handleTest = async () => {
    setTesting(true)
    try {
      await api.syncTest(syncBody)
      addToast('success', `${REPO_LABELS[repoSource]} 连接测试成功`)
    } catch (e) {
      addToast('error', `连接测试失败: ${(e as Error).message}`)
    } finally { setTesting(false) }
  }

  /* 通用输入框样式 */
  const inputCls = "h-[26px] border border-border bg-bg-card rounded px-2 text-[11px] text-text-1 outline-none placeholder-text-disabled shrink min-w-0"

  return (
    <>
      <div className="text-[16px] font-medium text-text-1 mb-5">数据同步</div>

      {/* ── 岛屿 1：资产同步基础 ── */}
      <SettingGroup>
        <SettingRow label="本地数据">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-3 truncate">此操作将导致本地连接/配置完全清空</span>
            {confirmClear ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => { setConfirmClear(false) }}
                  className="px-2 py-1 bg-bg-base text-text-2 rounded text-[11px] hover:bg-border transition-colors"
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
                  className="px-2 py-1 bg-status-error/10 text-status-error rounded text-[11px] font-medium hover:bg-status-error/20 transition-colors"
                >确认清除</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-2.5 py-1 bg-bg-base text-text-2 rounded text-[11px] hover:bg-border transition-colors shrink-0"
              >清除本地数据</button>
            )}
          </div>
        </SettingRow>

        <SettingRow label="云端同步">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-3 truncate">拉取将覆盖本地数据，推送将覆盖远端数据</span>
            <div className="flex gap-1.5 shrink-0">
              <button
                disabled={syncing}
                onClick={() => setConfirmImport(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-bg-base text-text-2 rounded text-[11px] hover:bg-border transition-colors disabled:opacity-50"
              >
                {syncing ? <AppIcon icon={icons.loader} size={11} className="animate-spin" /> : <AppIcon icon={icons.download} size={11} />}
                拉取
              </button>
              <button
                disabled={syncing}
                onClick={() => {
                  if (fileInfo?.exists) setConfirmExport(true)
                  else handleExport()
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-bg-base text-text-2 rounded text-[11px] hover:bg-border transition-colors disabled:opacity-50"
              >
                {syncing ? <AppIcon icon={icons.loader} size={11} className="animate-spin" /> : <AppIcon icon={icons.upload} size={11} />}
                推送
              </button>
            </div>
          </div>
        </SettingRow>

        <SettingRow label="私有云端资产">
          {confirmDeleteRemote ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setConfirmDeleteRemote(false)}
                className="px-2 py-1 bg-bg-base text-text-2 rounded text-[11px] hover:bg-border transition-colors"
              >取消</button>
              <button
                disabled={syncing}
                onClick={handleDeleteRemote}
                className="px-2 py-1 bg-status-error/10 text-status-error rounded text-[11px] font-medium hover:bg-status-error/20 transition-colors disabled:opacity-50"
              >确认删除</button>
            </div>
          ) : (
            <button
              disabled={syncing}
              onClick={() => setConfirmDeleteRemote(true)}
              className="px-2.5 py-1 bg-bg-base text-text-2 rounded text-[11px] hover:bg-border transition-colors shrink-0 disabled:opacity-50"
            >
              删除 {REPO_LABELS[repoSource]} 仓库资产
            </button>
          )}
        </SettingRow>

        <SettingRow label="自动同步" desc="新建资产时将自动进行同步">
          <Switch checked={autoSync} onCheckedChange={() => update('syncAutoSync', !autoSync)} />
        </SettingRow>

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
      <div className="mt-7">
        <div className="text-[14px] font-medium text-text-1 mb-4">
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
                    className={`w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors ${pickingDir ? 'animate-pulse' : ''}`}
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
            <>
              <SettingRow label="仓库地址">
                <input
                  type="text"
                  value={gitUrl}
                  onChange={(e) => update('syncGitUrl', e.target.value)}
                  placeholder="https:// 或 git@"
                  className={`${inputCls} w-full max-w-[320px]`}
                />
              </SettingRow>
              <SettingRow label="分支">
                <input
                  type="text"
                  value={gitBranch}
                  onChange={(e) => update('syncGitBranch', e.target.value)}
                  className={`${inputCls} w-full max-w-[200px]`}
                />
              </SettingRow>
              <SettingRow label="存储路径" desc="同步文件固定存放在仓库的 Vortix/ 目录下">
                <span className="text-[11px] text-text-3 font-mono">Vortix/vortix-sync.json</span>
              </SettingRow>
              {gitAuthType === 'https' ? (
                <>
                  <SettingRow label="用户名">
                    <input
                      type="text"
                      value={gitUsername}
                      onChange={(e) => update('syncGitUsername', e.target.value)}
                      className={`${inputCls} w-full max-w-[240px]`}
                    />
                  </SettingRow>
                  <SettingRow label="密码/Token" desc="建议使用 Personal Access Token">
                    <input
                      type="password"
                      value={gitPassword}
                      onChange={(e) => update('syncGitPassword', e.target.value)}
                      className={`${inputCls} w-full max-w-[240px]`}
                    />
                  </SettingRow>
                  <TlsToggleRow />
                </>
              ) : (
                <SettingRow label="SSH私钥">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      title="从本地文件导入私钥"
                      onClick={async () => {
                        try {
                          const result = await api.pickFile('选择 SSH 私钥文件', '私钥文件|*.pem;*.key;*.ppk;*.pub|所有文件|*.*')
                          if (result.content) update('syncGitSshKey', result.content.trim())
                        } catch { /* 静默 */ }
                      }}
                      className="w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors"
                    >
                      <AppIcon icon={icons.fileText} size={13} className="text-text-2" />
                    </button>
                    <button
                      type="button"
                      title="选择已配置的连接私钥"
                      onClick={() => setShowKeyPicker(true)}
                      className="w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors"
                    >
                      <AppIcon icon={icons.key} size={13} className="text-text-2" />
                    </button>
                    <input
                      type="text"
                      value={gitSshKey}
                      onChange={(e) => update('syncGitSshKey', e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                      className={`${inputCls} w-full max-w-[240px] font-mono`}
                    />
                  </div>
                </SettingRow>
              )}
              <EncryptionKeyRow />
            </>
          )}

          {/* ── WebDAV ── */}
          {repoSource === 'webdav' && (
            <>
              <SettingRow label="Endpoint">
                <input
                  type="text"
                  value={webdavEndpoint}
                  onChange={(e) => update('syncWebdavEndpoint', e.target.value)}
                  placeholder="http://webdav.com"
                  className={`${inputCls} w-full max-w-[320px]`}
                />
              </SettingRow>
              <SettingRow label="路径">
                <input
                  type="text"
                  value={webdavPath}
                  onChange={(e) => update('syncWebdavPath', e.target.value)}
                  className={`${inputCls} w-full max-w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="用户名">
                <input
                  type="text"
                  value={webdavUsername}
                  onChange={(e) => update('syncWebdavUsername', e.target.value)}
                  className={`${inputCls} w-full max-w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="密码">
                <input
                  type="password"
                  value={webdavPassword}
                  onChange={(e) => update('syncWebdavPassword', e.target.value)}
                  className={`${inputCls} w-full max-w-[240px]`}
                />
              </SettingRow>
              <EncryptionKeyRow />
              <TlsToggleRow />
            </>
          )}

          {/* ── S3 ── */}
          {repoSource === 's3' && (
            <>
              <SettingRow label="Addressing Style">
                <SettingsDropdown
                  value={s3Style}
                  options={[
                    { value: 'virtual-hosted', label: 'Virtual-Hosted Style' },
                    { value: 'path', label: 'Path Style' },
                  ]}
                  onChange={(v) => update('syncS3Style', v)}
                  width="w-[180px]"
                />
              </SettingRow>
              <SettingRow label="Endpoint">
                <input
                  type="text"
                  value={s3Endpoint}
                  onChange={(e) => update('syncS3Endpoint', e.target.value)}
                  className={`${inputCls} w-full max-w-[320px]`}
                />
              </SettingRow>
              <SettingRow label="路径">
                <input
                  type="text"
                  value={s3Path}
                  onChange={(e) => update('syncS3Path', e.target.value)}
                  className={`${inputCls} w-full max-w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="Region">
                <input
                  type="text"
                  value={s3Region}
                  onChange={(e) => update('syncS3Region', e.target.value)}
                  className={`${inputCls} w-full max-w-[200px]`}
                />
              </SettingRow>
              <SettingRow label="Bucket">
                <input
                  type="text"
                  value={s3Bucket}
                  onChange={(e) => update('syncS3Bucket', e.target.value)}
                  className={`${inputCls} w-full max-w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="AccessKey">
                <input
                  type="text"
                  value={s3AccessKey}
                  onChange={(e) => update('syncS3AccessKey', e.target.value)}
                  className={`${inputCls} w-full max-w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="SecretAccessKey">
                <input
                  type="password"
                  value={s3SecretKey}
                  onChange={(e) => update('syncS3SecretKey', e.target.value)}
                  className={`${inputCls} w-full max-w-[240px]`}
                />
              </SettingRow>
              <EncryptionKeyRow />
              <TlsToggleRow />
            </>
          )}

          {/* 测试同步 */}
          <SettingRow label="测试同步" desc="使用临时文件验证连通性，不影响真实同步数据">
            <button
              disabled={testing || syncing}
              onClick={handleTest}
              className="flex items-center gap-1 px-2.5 py-1 bg-bg-base text-text-2 rounded text-[11px] hover:bg-border transition-colors disabled:opacity-50 shrink-0"
            >
              {testing ? <AppIcon icon={icons.loader} size={11} className="animate-spin" /> : <AppIcon icon={icons.zap} size={11} />}
              测试同步
            </button>
          </SettingRow>
        </SettingGroup>
      </div>

      {/* 同步文件状态 */}
      {fileInfo && (
        <div className="mt-4 flex items-center gap-4 px-4 py-2.5 rounded-lg bg-bg-subtle text-[11px] text-text-2">
          <span className="flex items-center gap-1">
            {fileInfo.exists
              ? <><AppIcon icon={icons.checkCircle} size={12} className="text-chart-green" /> 同步文件已存在，如需恢复数据请点击「拉取」</>
              : <><AppIcon icon={icons.cloudOff} size={12} className="text-text-3" /> 同步文件不存在</>
            }
          </span>
          {fileInfo.lastModified && (
            <span>修改时间: {fileInfo.lastModified.replace('T', ' ').slice(0, 19)}</span>
          )}
          {fileInfo.size !== null && (
            <span>大小: {fileInfo.size < 1024 ? `${fileInfo.size} B` : fileInfo.size < 1048576 ? `${(fileInfo.size / 1024).toFixed(1)} KB` : `${(fileInfo.size / 1048576).toFixed(2)} MB`}</span>
          )}
          <button onClick={refreshFileInfo} className="p-1 hover:bg-border rounded transition-colors">
            <AppIcon icon={icons.refresh} size={11} className="text-text-3" />
          </button>
        </div>
      )}

      {/* 导入确认弹窗 */}
      {confirmImport && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="bg-bg-card rounded-xl shadow-2xl border border-border/60 w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
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
              <button onClick={() => setConfirmImport(false)} className="px-3.5 py-1.5 bg-bg-base text-text-2 rounded-lg text-[12px] font-medium hover:bg-border transition-colors">取消</button>
              <button onClick={() => handleImport()} className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">确认拉取</button>
            </div>
          </div>
        </div>
      )}

      {/* 推送确认弹窗 */}
      {confirmExport && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="bg-bg-card rounded-xl shadow-2xl border border-border/60 w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
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
              <button onClick={() => setConfirmExport(false)} className="px-3.5 py-1.5 bg-bg-base text-text-2 rounded-lg text-[12px] font-medium hover:bg-border transition-colors">取消</button>
              <button onClick={() => { setConfirmExport(false); handleExport() }} className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">确认推送</button>
            </div>
          </div>
        </div>
      )}

      {/* 冲突检测弹窗 */}
      {conflictInfo && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="bg-bg-card rounded-xl shadow-2xl border border-border/60 w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
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
              <button onClick={() => setConflictInfo(null)} className="px-3.5 py-1.5 bg-bg-base text-text-2 rounded-lg text-[12px] font-medium hover:bg-border transition-colors">取消</button>
              <button onClick={handleConflictUseRemote} className="px-3.5 py-1.5 bg-[#FF4D4F]/10 text-[#FF4D4F] rounded-lg text-[12px] font-medium hover:bg-[#FF4D4F]/20 transition-colors">使用远端数据</button>
              <button onClick={handleConflictUseLocal} className="px-3.5 py-1.5 bg-primary text-white rounded-lg text-[12px] font-medium hover:opacity-90 transition-opacity">使用本地数据</button>
            </div>
          </div>
        </div>
      )}

      {/* 安全提示 */}
      <div className="mt-6 flex items-start gap-2 px-4 py-3 rounded-lg bg-bg-subtle text-[11px] text-text-3">
        <AppIcon icon={icons.info} size={13} className="shrink-0 mt-0.5" />
        <span>同步数据始终加密传输。未设置自定义密钥时使用内置加密（防止明文泄露），设置后使用强加密（跨设备恢复需要密钥）。Git 仓库仅保留最新一次同步记录。</span>
      </div>

      {/* 私钥选择弹窗 */}
      {showKeyPicker && (
        <KeyPickerModal
          onSelect={(key) => update('syncGitSshKey', key)}
          onClose={() => setShowKeyPicker(false)}
        />
      )}
    </>
  )
}
