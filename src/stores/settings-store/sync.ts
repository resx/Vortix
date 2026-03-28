import type { SyncRequestBody } from '../../api/types'
import type { SettingsState } from './types'

export const SYNC_VERIFIED_SIGNATURE_HASH_KEY = 'vortix.sync.verifiedSignatureHash.v1'

export function hashSyncSignature(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export function buildSyncVerificationSignature(s: SettingsState): string {
  if (s.syncRepoSource === 'local') return `local|${s.syncLocalPath}`
  if (s.syncRepoSource === 'git') {
    const gitUrl = (s.syncGitUrl ?? '').trim().toLowerCase()
    const isSsh = gitUrl.startsWith('git@') || gitUrl.startsWith('ssh://')
    if (isSsh) return `git|ssh|${s.syncGitUrl}|${s.syncGitBranch}|${s.syncGitPath}|${s.syncGitSshKey}|${s.syncGitSshKeyLabel}|${s.syncGitSshKeyMode}`
    return `git|https|${s.syncGitUrl}|${s.syncGitBranch}|${s.syncGitPath}|${s.syncGitUsername}|${s.syncGitPassword}`
  }
  if (s.syncRepoSource === 'webdav') return `webdav|${s.syncWebdavEndpoint}|${s.syncWebdavPath}|${s.syncWebdavUsername}|${s.syncWebdavPassword}`
  return `s3|${s.syncS3Style}|${s.syncS3Endpoint}|${s.syncS3Path}|${s.syncS3Region}|${s.syncS3Bucket}|${s.syncS3AccessKey}|${s.syncS3SecretKey}`
}

export function isSyncConfigured(s: SettingsState): boolean {
  if (s.syncRepoSource === 'local') return !!(s.syncLocalPath ?? '').trim()
  if (s.syncRepoSource === 'git') return !!(s.syncGitUrl ?? '').trim()
  if (s.syncRepoSource === 'webdav') return !!(s.syncWebdavEndpoint ?? '').trim()
  if (s.syncRepoSource === 's3') return !!(s.syncS3Endpoint ?? '').trim() && !!(s.syncS3Bucket ?? '').trim() && !!(s.syncS3AccessKey ?? '').trim() && !!s.syncS3SecretKey
  return false
}

export function buildSyncBodyFromSettings(s: SettingsState): SyncRequestBody {
  const body: SyncRequestBody = {
    repoSource: s.syncRepoSource,
    syncFormatVersion: 5,
    syncUseChunkedManifest: false,
    syncHashAlgorithm: 'sha256',
    syncCompressChunks: true,
  }
  if (s.syncEncryptionKey.trim()) body.encryptionKey = s.syncEncryptionKey

  if (s.syncRepoSource === 'local') {
    body.syncLocalPath = s.syncLocalPath ?? ''
    return body
  }
  if (s.syncRepoSource === 'git') {
    const gitUrl = (s.syncGitUrl ?? '').trim()
    body.syncGitUrl = gitUrl
    if (s.syncGitBranch.trim()) body.syncGitBranch = s.syncGitBranch
    if (s.syncGitPath.trim()) body.syncGitPath = s.syncGitPath
    const lower = gitUrl.toLowerCase()
    const isSsh = lower.startsWith('git@') || lower.startsWith('ssh://')
    if (isSsh) {
      if (s.syncGitSshKey.trim()) body.syncGitSshKey = s.syncGitSshKey
    } else {
      if (s.syncGitUsername.trim()) body.syncGitUsername = s.syncGitUsername
      if (s.syncGitPassword) body.syncGitPassword = s.syncGitPassword
      if (!s.syncTlsVerify) body.syncTlsVerify = false
    }
    return body
  }
  if (s.syncRepoSource === 'webdav') {
    body.syncWebdavEndpoint = (s.syncWebdavEndpoint ?? '').trim()
    if (s.syncWebdavPath.trim()) body.syncWebdavPath = s.syncWebdavPath
    if (s.syncWebdavUsername.trim()) body.syncWebdavUsername = s.syncWebdavUsername
    if (s.syncWebdavPassword) body.syncWebdavPassword = s.syncWebdavPassword
    if (!s.syncTlsVerify) body.syncTlsVerify = false
    return body
  }
  if (s.syncRepoSource === 's3') {
    if (s.syncS3Style.trim()) body.syncS3Style = s.syncS3Style
    body.syncS3Endpoint = (s.syncS3Endpoint ?? '').trim()
    if (s.syncS3Path.trim()) body.syncS3Path = s.syncS3Path
    if (s.syncS3Region.trim()) body.syncS3Region = s.syncS3Region
    if (s.syncS3Bucket.trim()) body.syncS3Bucket = s.syncS3Bucket
    if (s.syncS3AccessKey.trim()) body.syncS3AccessKey = s.syncS3AccessKey
    if (s.syncS3SecretKey) body.syncS3SecretKey = s.syncS3SecretKey
    if (!s.syncTlsVerify) body.syncTlsVerify = false
    return body
  }
  return body
}
