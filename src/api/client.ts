/* ── 统一 HTTP API 封装 ── */

import type {
  ApiResponse,
  Folder,
  CreateFolderDto,
  UpdateFolderDto,
  Connection,
  CreateConnectionDto,
  UpdateConnectionDto,
  ConnectionCredential,
  Settings,
  CommandHistory,
} from './types'

// CEF 预留：运行时可通过 window.__VORTIX_CONFIG__ 覆盖
const config = (window as Record<string, unknown>).__VORTIX_CONFIG__ as { apiBaseUrl?: string } | undefined
const BASE_URL = config?.apiBaseUrl || 'http://localhost:3001/api'

/** 通用请求方法 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json: ApiResponse<T> = await res.json()
  if (!json.success) {
    throw new Error(json.error || '请求失败')
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
