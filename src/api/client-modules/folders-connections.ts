import type {
  BatchUpdateConnectionDto,
  Connection,
  ConnectionCredential,
  CreateConnectionDto,
  CreateFolderDto,
  Folder,
  RecentConnection,
  UpdateConnectionDto,
  UpdateFolderDto,
} from '../types'
import { request } from '../http'
import {
  bridgeBatchUpdateConnections,
  bridgeCreateConnection,
  bridgeCreateFolder,
  bridgeDeleteConnection,
  bridgeDeleteFolder,
  bridgeGetConnection,
  bridgeGetConnectionCredential,
  bridgeHealth,
  bridgeListConnections,
  bridgeListFolders,
  bridgePingConnections,
  bridgeUpdateConnection,
  bridgeUpdateFolder,
} from '../bridge'

export async function getFolders(): Promise<Folder[]> {
  try {
    return await bridgeListFolders()
  } catch {
    return request<Folder[]>('/folders')
  }
}

export async function createFolder(dto: CreateFolderDto): Promise<Folder> {
  try {
    return await bridgeCreateFolder(dto)
  } catch {
    return request<Folder>('/folders', {
      method: 'POST',
      body: JSON.stringify(dto),
    })
  }
}

export async function updateFolder(id: string, dto: UpdateFolderDto): Promise<Folder> {
  try {
    return await bridgeUpdateFolder(id, dto)
  } catch {
    return request<Folder>(`/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    })
  }
}

export async function deleteFolder(id: string): Promise<void> {
  try {
    await bridgeDeleteFolder(id)
  } catch {
    await request<void>(`/folders/${id}`, { method: 'DELETE' })
  }
}

export async function getConnections(folderId?: string): Promise<Connection[]> {
  try {
    return await bridgeListConnections(folderId)
  } catch {
    const query = folderId ? `?folder_id=${folderId}` : ''
    return request<Connection[]>(`/connections${query}`)
  }
}

export async function getConnection(id: string): Promise<Connection> {
  try {
    return await bridgeGetConnection(id)
  } catch {
    return request<Connection>(`/connections/${id}`)
  }
}

export async function getConnectionCredential(id: string): Promise<ConnectionCredential> {
  try {
    return await bridgeGetConnectionCredential(id)
  } catch {
    return request<ConnectionCredential>(`/connections/${id}/credential`)
  }
}

export async function createConnection(dto: CreateConnectionDto): Promise<Connection> {
  try {
    return await bridgeCreateConnection(dto)
  } catch {
    return request<Connection>('/connections', {
      method: 'POST',
      body: JSON.stringify(dto),
    })
  }
}

export async function updateConnection(id: string, dto: UpdateConnectionDto): Promise<Connection> {
  try {
    return await bridgeUpdateConnection(id, dto)
  } catch {
    return request<Connection>(`/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    })
  }
}

export async function deleteConnection(id: string): Promise<void> {
  try {
    await bridgeDeleteConnection(id)
  } catch {
    await request<void>(`/connections/${id}`, { method: 'DELETE' })
  }
}

export async function batchUpdateConnections(dto: BatchUpdateConnectionDto): Promise<Connection[]> {
  try {
    return await bridgeBatchUpdateConnections(dto)
  } catch {
    return request<Connection[]>('/connections/batch', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    })
  }
}

export async function pingConnections(ids: string[]): Promise<Record<string, number | null>> {
  try {
    return await bridgePingConnections(ids)
  } catch {
    return request<Record<string, number | null>>('/connections/ping', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  }
}

export async function healthCheck(): Promise<{ status: string }> {
  try {
    return await bridgeHealth()
  } catch {
    return request<{ status: string }>('/health')
  }
}

export async function getRecentConnections(limit = 15): Promise<RecentConnection[]> {
  return request<RecentConnection[]>(`/recent-connections?limit=${limit}`)
}
