import type { Dispatch, SetStateAction } from 'react'
import type { SyncConflictInfo, SyncFileInfo } from '../../../api/types'
import type { SettingsState } from '../../../stores/useSettingsStore'

export type SyncConnectionState = 'idle' | 'ok' | 'error'

export type SyncUpdateSetting = <K extends keyof SettingsState>(
  key: K,
  value: SettingsState[K],
) => void

export interface SyncSettingsState {
  update: SyncUpdateSetting
  repoSource: SettingsState['syncRepoSource']
  autoSync: boolean
  syncLocalPath: string
  gitUrl: string
  gitBranch: string
  gitPath: string
  gitUsername: string
  gitPassword: string
  gitSshKey: string
  syncGitSshKeyLabel: string
  syncGitSshKeyMode: SettingsState['syncGitSshKeyMode']
  webdavEndpoint: string
  webdavPath: string
  webdavUsername: string
  webdavPassword: string
  s3Style: SettingsState['syncS3Style']
  s3Endpoint: string
  s3Path: string
  s3Region: string
  s3Bucket: string
  s3AccessKey: string
  s3SecretKey: string
  gitAuthType: 'ssh' | 'https'
  syncing: boolean
  setSyncing: Dispatch<SetStateAction<boolean>>
  testing: boolean
  setTesting: Dispatch<SetStateAction<boolean>>
  fileInfo: SyncFileInfo | null
  setFileInfo: Dispatch<SetStateAction<SyncFileInfo | null>>
  connectionState: SyncConnectionState
  setConnectionState: Dispatch<SetStateAction<SyncConnectionState>>
  connectionHint: string
  setConnectionHint: Dispatch<SetStateAction<string>>
  confirmImport: boolean
  setConfirmImport: Dispatch<SetStateAction<boolean>>
  confirmExport: boolean
  setConfirmExport: Dispatch<SetStateAction<boolean>>
  confirmClear: boolean
  setConfirmClear: Dispatch<SetStateAction<boolean>>
  confirmDeleteRemote: boolean
  setConfirmDeleteRemote: Dispatch<SetStateAction<boolean>>
  conflictInfo: { info: SyncConflictInfo; action: 'push' | 'pull' } | null
  setConflictInfo: Dispatch<SetStateAction<{ info: SyncConflictInfo; action: 'push' | 'pull' } | null>>
  pickingDir: boolean
  setPickingDir: Dispatch<SetStateAction<boolean>>
  showKeyPicker: boolean
  setShowKeyPicker: Dispatch<SetStateAction<boolean>>
  manualKeyVisible: boolean
  setManualKeyVisible: Dispatch<SetStateAction<boolean>>
  syncBody: ReturnType<typeof import('../../../stores/useSettingsStore').buildSyncBody>
  hasManagerBinding: boolean
  maskedGitSshKey: string
  syncActionsEnabled: boolean
  preferPull: boolean
  preferPush: boolean
  syncHintText: string
  refreshFileInfo: () => Promise<boolean>
  persistVerifiedSignature: (verified: boolean) => void
}

export interface SyncSettingsActions {
  handleTest: () => Promise<void>
  handleExport: (force?: boolean) => Promise<void>
  handleImport: (force?: boolean) => Promise<void>
  handleConflictUseLocal: () => void
  handleConflictUseRemote: () => void
  handleDeleteRemote: () => Promise<void>
  handlePurgeAllData: () => Promise<void>
  handlePickLocalDir: () => Promise<void>
  handlePickGitSshKeyFile: () => Promise<void>
}

export const REPO_LABELS: Record<SettingsState['syncRepoSource'], string> = {
  local: '本地',
  git: 'GIT',
  webdav: 'WEBDAV',
  s3: 'S3',
}

export const formatSyncSize = (size: number | null): string => {
  if (size == null) return '--'
  if (size < 1024) return `${size} B`
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1048576).toFixed(2)} MB`
}

export const formatSyncTime = (time: string | null, includeSeconds = false): string => {
  if (!time) return '--'
  const parsed = new Date(time)
  if (Number.isNaN(parsed.getTime())) {
    const normalized = time.replace('T', ' ').replace('Z', '')
    return includeSeconds ? normalized.slice(0, 19) : normalized.slice(0, 16)
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  const seconds = includeSeconds ? `:${pad(parsed.getSeconds())}` : ''
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}${seconds}`
}
