import type { SftpFileEntry, SftpSortField } from '../../../../types/sftp'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function getFileExt(name: string, type: string): string {
  if (type === 'dir') return '文件夹'
  if (type === 'symlink') return '链接'
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '文件'
}

export function formatPermissionSubtitle(entry: SftpFileEntry): string {
  const raw = (entry.permissions || '').trim()
  if (!raw || raw === '-') return '-'
  if (entry.type === 'dir' && !raw.startsWith('d')) return `d${raw}`
  if (entry.type === 'file' && raw.startsWith('d') && raw.length > 1) return raw.slice(1)
  return raw
}

export const COLUMN_DEFS: Record<string, { field: SftpSortField | null; label: string; minWidth: number; align: string }> = {
  name: { field: 'name', label: '名称', minWidth: 180, align: 'text-left' },
  mtime: { field: 'modifiedAt', label: '修改时间', minWidth: 150, align: 'text-right' },
  size: { field: 'size', label: '大小', minWidth: 80, align: 'text-right' },
  type: { field: null, label: '类型', minWidth: 80, align: 'text-left' },
}
