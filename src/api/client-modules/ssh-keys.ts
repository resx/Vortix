import type { CreateSshKeyDto, GenerateSshKeyDto, SshKey, UpdateSshKeyDto } from '../types'
import { getCurrentApiBaseUrl, request } from '../http'

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
  return `${getCurrentApiBaseUrl()}/ssh-keys/${id}/export`
}
