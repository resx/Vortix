import type { CommandHistory } from '../types'
import { request } from '../http'

export interface TransferHistoryEntry {
  id: number
  transferId: string
  direction: 'upload' | 'download'
  remotePath: string
  bytesTransferred: number
  fileSize: number
  status: 'completed' | 'failed' | 'canceled'
  errorMessage?: string | null
  createdAt: string
}

export async function getHistory(connectionId: string, limit?: number): Promise<CommandHistory[]> {
  const query = limit ? `?limit=${limit}` : ''
  return request<CommandHistory[]>(`/history/${connectionId}${query}`)
}

export async function getHistorySuggestions(
  connectionId: string,
  input: string,
  limit = 60,
): Promise<CommandHistory[]> {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('suggest', '1')
  if (input.trim()) {
    params.set('q', input.trim())
  }
  return request<CommandHistory[]>(`/history/${connectionId}?${params.toString()}`)
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

export async function getTransferHistory(sessionKey?: string, limit = 100): Promise<TransferHistoryEntry[]> {
  const params = new URLSearchParams()
  params.set('limit', String(Math.max(1, Math.min(limit, 1000))))
  if (sessionKey?.trim()) {
    params.set('sessionKey', sessionKey.trim())
  }
  return request<TransferHistoryEntry[]>(`/transfers/history?${params.toString()}`)
}

export async function getTransferHistoryPage(options?: {
  sessionKey?: string
  limit?: number
  beforeId?: number
}): Promise<TransferHistoryEntry[]> {
  const params = new URLSearchParams()
  const limit = Math.max(1, Math.min(options?.limit ?? 100, 1000))
  params.set('limit', String(limit))
  if (options?.sessionKey?.trim()) {
    params.set('sessionKey', options.sessionKey.trim())
  }
  if (options?.beforeId && options.beforeId > 0) {
    params.set('beforeId', String(Math.floor(options.beforeId)))
  }
  return request<TransferHistoryEntry[]>(`/transfers/history?${params.toString()}`)
}
