import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildSyncBody,
  buildSyncVerificationSignature,
  hashSyncSignature,
  SYNC_VERIFIED_SIGNATURE_HASH_KEY,
  useSettingsStore,
} from '../../../stores/useSettingsStore'
import * as api from '../../../api/client'
import type { SyncSettingsState } from './sync-settings-types'
import { formatSyncSize, formatSyncTime } from './sync-settings-types'

function useGitAuthType(url: string): 'ssh' | 'https' {
  return useMemo(() => {
    const normalized = url.trim().toLowerCase()
    if (normalized.startsWith('git@') || normalized.startsWith('ssh://')) {
      return 'ssh'
    }
    return 'https'
  }, [url])
}

export function useSyncSettingsState(): SyncSettingsState {
  const update = useSettingsStore((state) => state.updateSetting)
  const repoSource = useSettingsStore((state) => state.syncRepoSource)
  const autoSync = useSettingsStore((state) => state.syncAutoSync)
  const syncLocalPath = useSettingsStore((state) => state.syncLocalPath)
  const gitUrl = useSettingsStore((state) => state.syncGitUrl)
  const gitBranch = useSettingsStore((state) => state.syncGitBranch)
  const gitPath = useSettingsStore((state) => state.syncGitPath)
  const gitUsername = useSettingsStore((state) => state.syncGitUsername)
  const gitPassword = useSettingsStore((state) => state.syncGitPassword)
  const gitSshKey = useSettingsStore((state) => state.syncGitSshKey)
  const syncGitSshKeyLabel = useSettingsStore((state) => state.syncGitSshKeyLabel)
  const syncGitSshKeyMode = useSettingsStore((state) => state.syncGitSshKeyMode)
  const webdavEndpoint = useSettingsStore((state) => state.syncWebdavEndpoint)
  const webdavPath = useSettingsStore((state) => state.syncWebdavPath)
  const webdavUsername = useSettingsStore((state) => state.syncWebdavUsername)
  const webdavPassword = useSettingsStore((state) => state.syncWebdavPassword)
  const s3Style = useSettingsStore((state) => state.syncS3Style)
  const s3Endpoint = useSettingsStore((state) => state.syncS3Endpoint)
  const s3Path = useSettingsStore((state) => state.syncS3Path)
  const s3Region = useSettingsStore((state) => state.syncS3Region)
  const s3Bucket = useSettingsStore((state) => state.syncS3Bucket)
  const s3AccessKey = useSettingsStore((state) => state.syncS3AccessKey)
  const s3SecretKey = useSettingsStore((state) => state.syncS3SecretKey)
  const gitAuthType = useGitAuthType(gitUrl)

  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [fileInfo, setFileInfo] = useState<SyncSettingsState['fileInfo']>(null)
  const [connectionState, setConnectionState] = useState<SyncSettingsState['connectionState']>('idle')
  const [connectionHint, setConnectionHint] = useState('')
  const [confirmImport, setConfirmImport] = useState(false)
  const [confirmExport, setConfirmExport] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDeleteRemote, setConfirmDeleteRemote] = useState(false)
  const [conflictInfo, setConflictInfo] = useState<SyncSettingsState['conflictInfo']>(null)
  const [pickingDir, setPickingDir] = useState(false)
  const [showKeyPicker, setShowKeyPicker] = useState(false)
  const [manualKeyVisible, setManualKeyVisible] = useState(false)

  const syncBody = buildSyncBody()
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

  const configSignature = buildSyncVerificationSignature(useSettingsStore.getState())
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
    if (repoSource === 'local' && !syncLocalPath.trim()) {
      setFileInfo(null)
      return false
    }
    if (repoSource === 'git' && !gitUrl.trim()) {
      setFileInfo(null)
      return false
    }
    if (repoSource === 'webdav' && !webdavEndpoint.trim()) {
      setFileInfo(null)
      return false
    }
    if (repoSource === 's3' && (!s3Endpoint.trim() || !s3Bucket.trim() || !s3AccessKey.trim() || !s3SecretKey.trim())) {
      setFileInfo(null)
      return false
    }

    try {
      const info = await api.getSyncStatus(syncBody)
      setFileInfo(info)
      return true
    } catch (error) {
      setFileInfo(null)
      setConnectionHint((error as Error).message || '获取同步信息失败')
      return false
    }
  }, [
    gitUrl,
    repoSource,
    s3AccessKey,
    s3Bucket,
    s3Endpoint,
    s3SecretKey,
    syncBody,
    syncLocalPath,
    webdavEndpoint,
  ])

  const checkedOnPageEnterRef = useRef(false)
  useEffect(() => {
    if (checkedOnPageEnterRef.current) return
    checkedOnPageEnterRef.current = true
    void refreshFileInfo()
  }, [refreshFileInfo])

  const syncActionsEnabled = connectionState === 'ok' && !syncing && !testing
  const preferPull = connectionState === 'ok' && fileInfo?.exists === true
  const preferPush = connectionState === 'ok' && fileInfo?.exists === false

  const syncHintText = useMemo(() => {
    if (connectionState === 'idle') return '配置已变更，请重新测试连接。'
    if (connectionState === 'error') return connectionHint || '连接失败，请检查配置后重试。'
    if (fileInfo?.exists) {
      const when = formatSyncTime(fileInfo.lastModified)
      const size = formatSyncSize(fileInfo.size)
      return `远端已存在同步包（更新于 ${when}，${size}）。`
    }
    if (fileInfo && !fileInfo.exists) {
      return '远端未发现同步包，可以直接导出。'
    }
    return connectionHint || '连接正常，可以开始同步。'
  }, [connectionHint, connectionState, fileInfo])

  return {
    update,
    repoSource,
    autoSync,
    syncLocalPath,
    gitUrl,
    gitBranch,
    gitPath,
    gitUsername,
    gitPassword,
    gitSshKey,
    syncGitSshKeyLabel,
    syncGitSshKeyMode,
    webdavEndpoint,
    webdavPath,
    webdavUsername,
    webdavPassword,
    s3Style,
    s3Endpoint,
    s3Path,
    s3Region,
    s3Bucket,
    s3AccessKey,
    s3SecretKey,
    gitAuthType,
    syncing,
    setSyncing,
    testing,
    setTesting,
    fileInfo,
    setFileInfo,
    connectionState,
    setConnectionState,
    connectionHint,
    setConnectionHint,
    confirmImport,
    setConfirmImport,
    confirmExport,
    setConfirmExport,
    confirmClear,
    setConfirmClear,
    confirmDeleteRemote,
    setConfirmDeleteRemote,
    conflictInfo,
    setConflictInfo,
    pickingDir,
    setPickingDir,
    showKeyPicker,
    setShowKeyPicker,
    manualKeyVisible,
    setManualKeyVisible,
    syncBody,
    hasManagerBinding,
    maskedGitSshKey,
    syncActionsEnabled,
    preferPull,
    preferPush,
    syncHintText,
    refreshFileInfo,
    persistVerifiedSignature,
  }
}
