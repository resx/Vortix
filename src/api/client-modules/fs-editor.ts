import { getCurrentApiBaseUrl, request } from '../http'

export interface LocalFsEntry {
  name: string
  path: string
  type: 'dir' | 'file' | 'other'
  size: number
  modifiedAt: string
  permissions?: string
  owner?: string
  group?: string
}

export async function listDirs(path?: string): Promise<{ path: string; dirs: string[] }> {
  const query = path ? `?path=${encodeURIComponent(path)}` : ''
  return request<{ path: string; dirs: string[] }>(`/fs/list-dirs${query}`)
}

export async function listLocalEntries(path?: string): Promise<{ path: string; entries: LocalFsEntry[] }> {
  const query = path ? `?path=${encodeURIComponent(path)}` : ''
  return request<{ path: string; entries: LocalFsEntry[] }>(`/fs/list-local-entries${query}`)
}

export async function pickDir(initialDir?: string): Promise<string | null> {
  const result = await request<{ path: string | null }>('/fs/pick-dir', {
    method: 'POST',
    body: JSON.stringify({ initialDir }),
  })
  return result.path
}

export async function pickFile(
  title?: string,
  filters?: string,
): Promise<{ path: string | null; content: string | null }> {
  return request<{ path: string | null; content: string | null }>('/fs/pick-file', {
    method: 'POST',
    body: JSON.stringify({ title, filters }),
  })
}

export async function saveDownloadToLocal(blob: Blob, fileName: string, targetDir?: string): Promise<string> {
  const res = await fetch(`${getCurrentApiBaseUrl()}/fs/save-download`, {
    method: 'POST',
    headers: {
      'X-File-Name': fileName,
      ...(targetDir ? { 'X-Target-Dir': targetDir } : {}),
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: blob,
  })
  const json = await res.json() as { success: boolean; data?: { path: string }; error?: string }
  if (!json.success) {
    throw new Error(json.error || '保存失败')
  }
  return json.data!.path
}

export async function openLocalFile(filePath: string): Promise<void> {
  return request<void>('/fs/open-local', {
    method: 'POST',
    body: JSON.stringify({ path: filePath }),
  })
}

export async function pickSavePath(fileName?: string, filters?: string): Promise<string | null> {
  const result = await request<{ path: string | null }>('/fs/pick-save-path', {
    method: 'POST',
    body: JSON.stringify({ fileName, filters }),
  })
  return result.path
}
