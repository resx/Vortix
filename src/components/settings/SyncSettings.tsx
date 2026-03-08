import { useState, useEffect, useCallback, useMemo } from 'react'
import { SettingRow, SettingGroup } from './SettingGroup'
import { useSettingsStore, type SettingsState } from '../../stores/useSettingsStore'
import { useAppStore } from '../../stores/useAppStore'
import { Switch } from '../ui/switch'
import { SettingsDropdown } from '../ui/select'
import * as api from '../../api/client'
import type { SyncFileInfo, ImportResult, SyncRequestBody } from '../../api/types'
import {
  Eye, EyeOff, FolderPlus, Upload, Download,
  RefreshCw, Trash2, AlertTriangle, FileText, Key,
  CheckCircle2, Loader2, CloudOff, Info, Folder,
} from 'lucide-react'
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
    <SettingRow label="数据加密密钥" desc="不填则不加密，修改密钥后请先删除旧数据再同步">
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors"
        >
          {visible ? <EyeOff size={13} className="text-text-2" /> : <Eye size={13} className="text-text-2" />}
        </button>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => update('syncEncryptionKey', e.target.value)}
          className="w-[240px] h-[26px] border border-border bg-bg-card rounded px-2 text-[11px] text-text-1 outline-none"
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
  const syncEncryptionKey = useSettingsStore((s) => s.syncEncryptionKey)
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
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [fileInfo, setFileInfo] = useState<SyncFileInfo | null>(null)
  const [confirmImport, setConfirmImport] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteRemote, setConfirmDeleteRemote] = useState(false)
  const [pickingDir, setPickingDir] = useState(false)
  const [showKeyPicker, setShowKeyPicker] = useState(false)

  /** 从 store 收集当前源配置，构建请求体 */
  const buildSyncBody = useCallback((): SyncRequestBody => {
    const s = useSettingsStore.getState()
    return {
      repoSource: s.syncRepoSource,
      encryptionKey: s.syncEncryptionKey || undefined,
      syncLocalPath: s.syncLocalPath ?? '',
      syncTlsVerify: s.syncTlsVerify,
      syncGitUrl: s.syncGitUrl ?? '',
      syncGitBranch: s.syncGitBranch ?? 'master',
      syncGitPath: s.syncGitPath ?? '',
      syncGitUsername: s.syncGitUsername ?? '',
      syncGitPassword: s.syncGitPassword ?? '',
      syncGitSshKey: s.syncGitSshKey ?? '',
      syncWebdavEndpoint: s.syncWebdavEndpoint ?? '',
      syncWebdavPath: s.syncWebdavPath ?? 'vortix',
      syncWebdavUsername: s.syncWebdavUsername ?? '',
      syncWebdavPassword: s.syncWebdavPassword ?? '',
      syncS3Style: s.syncS3Style ?? 'virtual-hosted',
      syncS3Endpoint: s.syncS3Endpoint ?? '',
      syncS3Path: s.syncS3Path ?? 'vortix',
      syncS3Region: s.syncS3Region ?? 'ap-east-1',
      syncS3Bucket: s.syncS3Bucket ?? '',
      syncS3AccessKey: s.syncS3AccessKey ?? '',
      syncS3SecretKey: s.syncS3SecretKey ?? '',
    }
  }, [])

  /* 刷新同步文件状态（所有源） */
  const refreshFileInfo = useCallback(async () => {
    if (repoSource === 'local' && !syncLocalPath.trim()) { setFileInfo(null); return }
    if (repoSource === 'git' && !gitUrl.trim()) { setFileInfo(null); return }
    if (repoSource === 'webdav' && !webdavEndpoint.trim()) { setFileInfo(null); return }
    if (repoSource === 's3' && !s3Endpoint.trim()) { setFileInfo(null); return }
    try {
      const info = await api.getSyncStatus(buildSyncBody())
      setFileInfo(info)
    } catch { setFileInfo(null) }
  }, [repoSource, syncLocalPath, gitUrl, gitBranch, gitPath, webdavEndpoint, webdavPath, s3Endpoint, s3Path, s3Bucket, buildSyncBody])

  useEffect(() => { refreshFileInfo() }, [refreshFileInfo])

  /* 导出 */
  const handleExport = async () => {
    if (repoSource === 'local' && !syncLocalPath.trim()) {
      setSyncResult({ type: 'error', message: '请填写同步路径' }); return
    }
    setSyncing(true); setSyncResult(null)
    try {
      await api.syncExport(buildSyncBody())
      setSyncResult({ type: 'success', message: '导出成功' })
      await refreshFileInfo()
    } catch (e) {
      setSyncResult({ type: 'error', message: (e as Error).message })
    } finally { setSyncing(false) }
  }

  /* 导入 */
  const handleImport = async () => {
    if (repoSource === 'local' && !syncLocalPath.trim()) {
      setSyncResult({ type: 'error', message: '请填写同步路径' }); return
    }
    setSyncing(true); setSyncResult(null); setConfirmImport(false)
    try {
      const result: ImportResult = await api.syncImport(buildSyncBody())
      setSyncResult({
        type: 'success',
        message: `导入成功：${result.folders} 个文件夹、${result.connections} 个连接、${result.settings} 项设置、${result.shortcuts} 个快捷命令`,
      })
      await Promise.all([
        useSettingsStore.getState().loadSettings(),
        useAppStore.getState().fetchAssets(),
        useAppStore.getState().fetchShortcuts(),
      ])
      await refreshFileInfo()
    } catch (e) {
      setSyncResult({ type: 'error', message: (e as Error).message })
    } finally { setSyncing(false) }
  }

  /* 删除远端同步文件 */
  const handleDeleteRemote = async () => {
    setSyncing(true); setSyncResult(null); setConfirmDeleteRemote(false)
    try {
      await api.deleteSyncRemote(buildSyncBody())
      setSyncResult({ type: 'success', message: '远端同步数据已删除' })
      await refreshFileInfo()
    } catch (e) {
      setSyncResult({ type: 'error', message: (e as Error).message })
    } finally { setSyncing(false) }
  }

  /* 通用输入框样式 */
  const inputCls = "h-[26px] border border-border bg-bg-card rounded px-2 text-[11px] text-text-1 outline-none placeholder-text-disabled shrink-0"

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
                      await useAppStore.getState().fetchAssets()
                      await useAppStore.getState().fetchShortcuts()
                      setSyncResult({ type: 'success', message: '本地数据已清除' })
                    } catch (e) { setSyncResult({ type: 'error', message: (e as Error).message }) }
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

        <SettingRow label="本地仓库资产导入/导出">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-3 truncate">导入资产时将以配置内容优先进行覆盖</span>
            <div className="flex gap-1.5 shrink-0">
              <button
                disabled={syncing}
                onClick={() => setConfirmImport(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-bg-base text-text-2 rounded text-[11px] hover:bg-border transition-colors disabled:opacity-50"
              >
                {syncing ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                导入
              </button>
              <button
                disabled={syncing}
                onClick={handleExport}
                className="flex items-center gap-1 px-2.5 py-1 bg-bg-base text-text-2 rounded text-[11px] hover:bg-border transition-colors disabled:opacity-50"
              >
                {syncing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                导出
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
                    <Folder size={13} className="text-text-2" />
                  </button>
                  <input
                    type="text"
                    value={syncLocalPath}
                    onChange={(e) => update('syncLocalPath', e.target.value)}
                    placeholder="选择或输入同步目录"
                    className={`${inputCls} w-[280px]`}
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
                  className={`${inputCls} w-[320px]`}
                />
              </SettingRow>
              <SettingRow label="分支">
                <input
                  type="text"
                  value={gitBranch}
                  onChange={(e) => update('syncGitBranch', e.target.value)}
                  className={`${inputCls} w-[200px]`}
                />
              </SettingRow>
              <SettingRow label="路径" desc="仓库内子目录，留空则存放在根目录">
                <input
                  type="text"
                  value={gitPath}
                  onChange={(e) => update('syncGitPath', e.target.value)}
                  placeholder="例如: vortix 或 data/sync"
                  className={`${inputCls} w-[200px]`}
                />
              </SettingRow>
              {gitAuthType === 'https' ? (
                <>
                  <SettingRow label="用户名">
                    <input
                      type="text"
                      value={gitUsername}
                      onChange={(e) => update('syncGitUsername', e.target.value)}
                      className={`${inputCls} w-[240px]`}
                    />
                  </SettingRow>
                  <SettingRow label="密码/Token" desc="建议使用 Personal Access Token">
                    <input
                      type="password"
                      value={gitPassword}
                      onChange={(e) => update('syncGitPassword', e.target.value)}
                      className={`${inputCls} w-[240px]`}
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
                      <FileText size={13} className="text-text-2" />
                    </button>
                    <button
                      type="button"
                      title="选择已配置的连接私钥"
                      onClick={() => setShowKeyPicker(true)}
                      className="w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors"
                    >
                      <Key size={13} className="text-text-2" />
                    </button>
                    <input
                      type="text"
                      value={gitSshKey}
                      onChange={(e) => update('syncGitSshKey', e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                      className={`${inputCls} w-[240px] font-mono`}
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
                  className={`${inputCls} w-[320px]`}
                />
              </SettingRow>
              <SettingRow label="路径">
                <input
                  type="text"
                  value={webdavPath}
                  onChange={(e) => update('syncWebdavPath', e.target.value)}
                  className={`${inputCls} w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="用户名">
                <input
                  type="text"
                  value={webdavUsername}
                  onChange={(e) => update('syncWebdavUsername', e.target.value)}
                  className={`${inputCls} w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="密码">
                <input
                  type="password"
                  value={webdavPassword}
                  onChange={(e) => update('syncWebdavPassword', e.target.value)}
                  className={`${inputCls} w-[240px]`}
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
                  className={`${inputCls} w-[320px]`}
                />
              </SettingRow>
              <SettingRow label="路径">
                <input
                  type="text"
                  value={s3Path}
                  onChange={(e) => update('syncS3Path', e.target.value)}
                  className={`${inputCls} w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="Region">
                <input
                  type="text"
                  value={s3Region}
                  onChange={(e) => update('syncS3Region', e.target.value)}
                  className={`${inputCls} w-[200px]`}
                />
              </SettingRow>
              <SettingRow label="Bucket">
                <input
                  type="text"
                  value={s3Bucket}
                  onChange={(e) => update('syncS3Bucket', e.target.value)}
                  className={`${inputCls} w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="AccessKey">
                <input
                  type="text"
                  value={s3AccessKey}
                  onChange={(e) => update('syncS3AccessKey', e.target.value)}
                  className={`${inputCls} w-[240px]`}
                />
              </SettingRow>
              <SettingRow label="SecretAccessKey">
                <input
                  type="password"
                  value={s3SecretKey}
                  onChange={(e) => update('syncS3SecretKey', e.target.value)}
                  className={`${inputCls} w-[240px]`}
                />
              </SettingRow>
              <EncryptionKeyRow />
              <TlsToggleRow />
            </>
          )}
        </SettingGroup>
      </div>

      {/* 同步文件状态 */}
      {fileInfo && (
        <div className="mt-4 flex items-center gap-4 px-4 py-2.5 rounded-lg bg-bg-subtle text-[11px] text-text-2">
          <span className="flex items-center gap-1">
            {fileInfo.exists
              ? <><CheckCircle2 size={12} className="text-chart-green" /> 同步文件已存在</>
              : <><CloudOff size={12} className="text-text-3" /> 同步文件不存在</>
            }
          </span>
          {fileInfo.lastModified && (
            <span>修改时间: {fileInfo.lastModified.replace('T', ' ').slice(0, 19)}</span>
          )}
          {fileInfo.size !== null && (
            <span>大小: {fileInfo.size < 1024 ? `${fileInfo.size} B` : fileInfo.size < 1048576 ? `${(fileInfo.size / 1024).toFixed(1)} KB` : `${(fileInfo.size / 1048576).toFixed(2)} MB`}</span>
          )}
          <button onClick={refreshFileInfo} className="p-1 hover:bg-border rounded transition-colors">
            <RefreshCw size={11} className="text-text-3" />
          </button>
        </div>
      )}

      {/* 操作结果提示 */}
      {syncResult && (
        <div className={`mt-4 flex items-start gap-2 px-4 py-3 rounded-lg text-[12px] max-h-[120px] overflow-y-auto custom-scrollbar ${
          syncResult.type === 'success' ? 'bg-chart-green/10 text-chart-green' : 'bg-status-error/10 text-status-error'
        }`}>
          {syncResult.type === 'success' ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
          <span className="break-all whitespace-pre-wrap min-w-0">{syncResult.message}</span>
        </div>
      )}

      {/* 导入确认 */}
      {confirmImport && (
        <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-[#FFF7E6] dark:bg-[#3D3520] border border-[#FFD666]/30">
          <AlertTriangle size={16} className="text-[#E6A23C] shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[13px] font-medium text-text-1 mb-1">确认导入？</div>
            <div className="text-[12px] text-text-2 mb-3">导入将覆盖所有本地数据（连接、文件夹、设置、快捷命令）。当前数据库已自动备份。</div>
            <div className="flex items-center gap-2">
              <button onClick={handleImport} className="px-3 py-1.5 bg-primary text-white rounded-md text-[12px] font-medium hover:opacity-90 transition-opacity">确认导入</button>
              <button onClick={() => setConfirmImport(false)} className="px-3 py-1.5 bg-bg-base text-text-2 rounded-md text-[12px] font-medium hover:bg-border transition-colors">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 安全提示 */}
      <div className="mt-6 flex items-start gap-2 px-4 py-3 rounded-lg bg-bg-subtle text-[11px] text-text-3">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>同步文件包含所有连接凭据（密码、私钥），请确保同步目录/仓库安全。加密密钥用于保护文件内容，请妥善保管。</span>
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
