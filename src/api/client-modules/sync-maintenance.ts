import type {
  CleanupResult,
  ImportResult,
  RemoteCheckResult,
  SyncConflictInfo,
  SyncFileInfo,
  SyncLocalState,
  SyncRequestBody,
} from '../types'
import { request } from '../http'

export async function syncTest(body: SyncRequestBody): Promise<void> {
  return request<void>('/sync/test', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function syncExport(body: SyncRequestBody): Promise<void> {
  return request<void>('/sync/export', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function syncImport(body: SyncRequestBody): Promise<ImportResult> {
  return request<ImportResult>('/sync/import', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getSyncStatus(body: SyncRequestBody): Promise<SyncFileInfo> {
  return request<SyncFileInfo>('/sync/status', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getSyncLocalState(): Promise<SyncLocalState> {
  return request<SyncLocalState>('/sync/local-state')
}

export async function deleteSyncRemote(body: SyncRequestBody): Promise<void> {
  return request<void>('/sync/remote', {
    method: 'DELETE',
    body: JSON.stringify(body),
  })
}

export async function checkPushConflict(body: SyncRequestBody): Promise<SyncConflictInfo> {
  return request<SyncConflictInfo>('/sync/check-push', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function checkPullConflict(body: SyncRequestBody): Promise<SyncConflictInfo> {
  return request<SyncConflictInfo>('/sync/check-pull', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function checkRemoteChanged(body: SyncRequestBody): Promise<RemoteCheckResult> {
  return request<RemoteCheckResult>('/sync/check-remote', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function cleanupData(): Promise<CleanupResult> {
  return request<CleanupResult>('/maintenance/cleanup', { method: 'POST' })
}

export async function purgeAllData(): Promise<void> {
  return request<void>('/maintenance/purge-all', { method: 'POST' })
}
