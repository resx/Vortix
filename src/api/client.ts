/* ── 统一 HTTP API 封装 ── */

import type {
  ApiResponse,
  Folder,
  CreateFolderDto,
  UpdateFolderDto,
  Connection,
  CreateConnectionDto,
  UpdateConnectionDto,
  BatchUpdateConnectionDto,
  ConnectionCredential,
  Settings,
  CommandHistory,
  TestResult,
  RecentConnection,
  CleanupResult,
  Shortcut,
  CreateShortcutDto,
  UpdateShortcutDto,
  SshKey,
  CreateSshKeyDto,
  UpdateSshKeyDto,
  GenerateSshKeyDto,
} from './types'

// CEF 预留：运行时可通过 window.__VORTIX_CONFIG__ 覆盖
const config = (window as unknown as Record<string, unknown>).__VORTIX_CONFIG__ as { apiBaseUrl?: string } | undefined
const BASE_URL = config?.apiBaseUrl || 'http://localhost:3002/api'
if (config) Object.freeze(config)

/** 通用请求方法 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options?.headers,
    },
  })
  const raw = await res.text()
  let json: ApiResponse<T> | null = null
  try {
    json = raw ? JSON.parse(raw) as ApiResponse<T> : null
  } catch {
    const short = raw.slice(0, 240)
    throw new Error(`HTTP ${res.status}: ${short || '响应非 JSON'}`)
  }
  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`)
  }
  if (!json?.success) {
    throw new Error(json?.error || '请求失败')
  }
  return json.data as T
}

/* ── 文件夹 API ── */

export async function getFolders(): Promise<Folder[]> {
  return request<Folder[]>('/folders')
}

export async function createFolder(dto: CreateFolderDto): Promise<Folder> {
  return request<Folder>('/folders', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateFolder(id: string, dto: UpdateFolderDto): Promise<Folder> {
  return request<Folder>(`/folders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteFolder(id: string): Promise<void> {
  return request<void>(`/folders/${id}`, { method: 'DELETE' })
}

/* ── 连接 API ── */

export async function getConnections(folderId?: string): Promise<Connection[]> {
  const query = folderId ? `?folder_id=${folderId}` : ''
  return request<Connection[]>(`/connections${query}`)
}

export async function getConnection(id: string): Promise<Connection> {
  return request<Connection>(`/connections/${id}`)
}

export async function getConnectionCredential(id: string): Promise<ConnectionCredential> {
  return request<ConnectionCredential>(`/connections/${id}/credential`)
}

export async function createConnection(dto: CreateConnectionDto): Promise<Connection> {
  return request<Connection>('/connections', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateConnection(id: string, dto: UpdateConnectionDto): Promise<Connection> {
  return request<Connection>(`/connections/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteConnection(id: string): Promise<void> {
  return request<void>(`/connections/${id}`, { method: 'DELETE' })
}

export async function batchUpdateConnections(dto: BatchUpdateConnectionDto): Promise<Connection[]> {
  return request<Connection[]>('/connections/batch', {
    method: 'PATCH',
    body: JSON.stringify(dto),
  })
}

/* ── 设置 API ── */

export async function getSettings(): Promise<Settings> {
  return request<Settings>('/settings')
}

export async function saveSettings(settings: Settings): Promise<void> {
  return request<void>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export async function resetSettings(): Promise<void> {
  return request<void>('/settings/reset', { method: 'POST' })
}

/* ── 命令历史 API ── */

export async function getHistory(connectionId: string, limit?: number): Promise<CommandHistory[]> {
  const query = limit ? `?limit=${limit}` : ''
  return request<CommandHistory[]>(`/history/${connectionId}${query}`)
}

export async function addHistory(connectionId: string, command: string): Promise<CommandHistory> {
  return request<CommandHistory>('/history', {
    method: 'POST',
    body: JSON.stringify({ connection_id: connectionId, command }),
  })
}

export async function clearHistory(connectionId: string): Promise<void> {
  return request<void>(`/history/${connectionId}`, { method: 'DELETE' })
}

/* ── 健康检查 ── */

export async function healthCheck(): Promise<{ status: string }> {
  return request<{ status: string }>('/health')
}

/* ── 文件系统 ── */

export async function listDirs(path?: string): Promise<{ path: string; dirs: string[] }> {
  const query = path ? `?path=${encodeURIComponent(path)}` : ''
  return request<{ path: string; dirs: string[] }>(`/fs/list-dirs${query}`)
}

export async function pickDir(initialDir?: string): Promise<string | null> {
  const result = await request<{ path: string | null }>('/fs/pick-dir', {
    method: 'POST',
    body: JSON.stringify({ initialDir }),
  })
  return result.path
}

export async function pickFile(title?: string, filters?: string): Promise<{ path: string | null; content: string | null }> {
  return request<{ path: string | null; content: string | null }>('/fs/pick-file', {
    method: 'POST',
    body: JSON.stringify({ title, filters }),
  })
}

/** 保存二进制数据到本地磁盘（默认 ~/Downloads/vortix-download/） */
export async function saveDownloadToLocal(blob: Blob, fileName: string, targetDir?: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/fs/save-download`, {
    method: 'POST',
    headers: {
      'X-File-Name': fileName,
      ...(targetDir ? { 'X-Target-Dir': targetDir } : {}),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: blob,
  })
  const json = await res.json() as { success: boolean; data?: { path: string }; error?: string }
  if (!json.success) throw new Error(json.error || '保存失败')
  return json.data!.path
}

/** 用系统默认程序打开本地文件 */
export async function openLocalFile(filePath: string): Promise<void> {
  return request<void>('/fs/open-local', {
    method: 'POST',
    body: JSON.stringify({ path: filePath }),
  })
}

/** 调用系统原生保存文件对话框 */
export async function pickSavePath(fileName?: string, filters?: string): Promise<string | null> {
  const result = await request<{ path: string | null }>('/fs/pick-save-path', {
    method: 'POST',
    body: JSON.stringify({ fileName, filters }),
  })
  return result.path
}

/* ── SSH 密钥库 API ── */

/* ── 连接预设 API ── */

export async function getPresets(): Promise<import('./types').PresetPublic[]> {
  return request<import('./types').PresetPublic[]>('/presets')
}

export async function getPreset(id: string): Promise<import('./types').PresetPublic> {
  return request<import('./types').PresetPublic>(`/presets/${id}`)
}

export async function getPresetCredential(id: string): Promise<import('./types').PresetCredential> {
  return request<import('./types').PresetCredential>(`/presets/${id}/credential`)
}

export async function createPreset(dto: import('./types').CreatePresetDto): Promise<import('./types').PresetPublic> {
  return request<import('./types').PresetPublic>('/presets', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updatePreset(id: string, dto: import('./types').UpdatePresetDto): Promise<import('./types').PresetPublic> {
  return request<import('./types').UpdatePresetDto>(`/presets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  }) as Promise<import('./types').PresetPublic>
}

export async function deletePreset(id: string): Promise<void> {
  return request<void>(`/presets/${id}`, { method: 'DELETE' })
}

/* ── SSH 密钥库 API ── */

export async function getCustomThemes(): Promise<import('./types').CustomThemePublic[]> {
  return request<import('./types').CustomThemePublic[]>('/themes')
}

export async function getCustomTheme(id: string): Promise<import('./types').CustomThemePublic> {
  return request<import('./types').CustomThemePublic>(`/themes/${id}`)
}

export async function createCustomTheme(dto: import('./types').CreateCustomThemeDto): Promise<import('./types').CustomThemePublic> {
  return request<import('./types').CustomThemePublic>('/themes', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateCustomTheme(id: string, dto: import('./types').UpdateCustomThemeDto): Promise<import('./types').CustomThemePublic> {
  return request<import('./types').CustomThemePublic>(`/themes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteCustomTheme(id: string): Promise<void> {
  return request<void>(`/themes/${id}`, { method: 'DELETE' })
}

export async function importThemes(raw: string): Promise<import('./types').ImportThemesResult> {
  return request<import('./types').ImportThemesResult>('/themes/import', {
    method: 'POST',
    body: JSON.stringify({ raw }),
  })
}

export function getThemeExportUrl(id: string): string {
  return `${BASE_URL}/themes/${id}/export`
}

export async function getSshKeys(): Promise<SshKey[]> {
  return request<SshKey[]>('/ssh-keys')
}

export async function getSshKey(id: string): Promise<SshKey> {
  return request<SshKey>(`/ssh-keys/${id}`)
}

export async function getSshKeyPrivate(id: string): Promise<{ private_key: string }> {
  return request<{ private_key: string }>(`/ssh-keys/${id}/private`)
}

export async function getSshKeyCredential(id: string): Promise<{ private_key: string; passphrase?: string }> {
  return request<{ private_key: string; passphrase?: string }>(`/ssh-keys/${id}/credential`)
}

export async function createSshKey(dto: CreateSshKeyDto): Promise<SshKey> {
  return request<SshKey>('/ssh-keys', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function generateSshKey(data: GenerateSshKeyDto): Promise<SshKey & { publicKey: string }> {
  return request<SshKey & { publicKey: string }>('/ssh-keys/generate', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSshKey(id: string, dto: UpdateSshKeyDto): Promise<SshKey> {
  return request<SshKey>(`/ssh-keys/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteSshKey(id: string): Promise<void> {
  return request<void>(`/ssh-keys/${id}`, { method: 'DELETE' })
}

export function getSshKeyExportUrl(id: string): string {
  return `${BASE_URL}/ssh-keys/${id}/export`
}

/* ── 测试连接 ── */

export async function pingConnections(ids: string[]): Promise<Record<string, number | null>> {
  return request<Record<string, number | null>>('/connections/ping', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
}

export async function uploadSshKey(connectionId: string, keyId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/connections/${connectionId}/upload-key`, {
    method: 'POST',
    body: JSON.stringify({ keyId }),
  })
}

export async function testSshConnection(data: Record<string, unknown>): Promise<TestResult> {
  const res = await fetch(`${BASE_URL}/connections/test-ssh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<TestResult>
}

export async function testLocalTerminal(data: { shell: string; workingDir?: string }): Promise<TestResult> {
  const res = await fetch(`${BASE_URL}/connections/test-local`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<TestResult>
}

/* ── 最近连接 API ── */

export async function getRecentConnections(limit = 15): Promise<RecentConnection[]> {
  return request<RecentConnection[]>(`/recent-connections?limit=${limit}`)
}

/* ── 数据清理 API ── */

export async function cleanupData(): Promise<CleanupResult> {
  return request<CleanupResult>('/maintenance/cleanup', { method: 'POST' })
}

/* ── 快捷命令 API ── */

export async function getShortcuts(): Promise<Shortcut[]> {
  return request<Shortcut[]>('/shortcuts')
}

export async function createShortcut(dto: CreateShortcutDto): Promise<Shortcut> {
  return request<Shortcut>('/shortcuts', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function updateShortcut(id: string, dto: UpdateShortcutDto): Promise<Shortcut> {
  return request<Shortcut>(`/shortcuts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  })
}

export async function deleteShortcut(id: string): Promise<void> {
  return request<void>(`/shortcuts/${id}`, { method: 'DELETE' })
}

/* ── 云同步 API ── */

export async function syncTest(body: import('./types').SyncRequestBody): Promise<void> {
  return request<void>('/sync/test', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function syncExport(body: import('./types').SyncRequestBody): Promise<void> {
  return request<void>('/sync/export', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function syncImport(body: import('./types').SyncRequestBody): Promise<import('./types').ImportResult> {
  return request<import('./types').ImportResult>('/sync/import', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getSyncStatus(body: import('./types').SyncRequestBody): Promise<import('./types').SyncFileInfo> {
  return request<import('./types').SyncFileInfo>('/sync/status', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function deleteSyncRemote(body: import('./types').SyncRequestBody): Promise<void> {
  return request<void>('/sync/remote', {
    method: 'DELETE',
    body: JSON.stringify(body),
  })
}

export async function checkPushConflict(body: import('./types').SyncRequestBody): Promise<import('./types').SyncConflictInfo> {
  return request<import('./types').SyncConflictInfo>('/sync/check-push', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function checkPullConflict(body: import('./types').SyncRequestBody): Promise<import('./types').SyncConflictInfo> {
  return request<import('./types').SyncConflictInfo>('/sync/check-pull', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function purgeAllData(): Promise<void> {
  return request<void>('/maintenance/purge-all', { method: 'POST' })
}

/** 获取 WebSocket 基础 URL（自动检测 ws/wss 协议） */
export function getWsBaseUrl(): string {
  try {
    const url = new URL(BASE_URL)
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${url.host}`
  } catch {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${location.host}`
  }
}

