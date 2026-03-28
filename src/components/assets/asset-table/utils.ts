import type { AssetRow } from '../../../types'

export type SortKey = 'name' | 'latency' | 'host' | 'user' | 'created' | 'expire' | 'remark'
export type SortDir = 'asc' | 'desc' | null

export const columns: { key: SortKey; label: string; width: string }[] = [
  { key: 'name', label: '名称', width: 'w-[20%]' },
  { key: 'latency', label: '延迟', width: 'w-[10%]' },
  { key: 'host', label: 'Host', width: 'w-[15%]' },
  { key: 'user', label: 'User', width: 'w-[15%]' },
  { key: 'created', label: '创建时间', width: 'w-[15%]' },
  { key: 'expire', label: '到期时间', width: 'w-[15%]' },
  { key: 'remark', label: '备注', width: 'w-[10%]' },
]

export function latencyColor(val: string): string {
  if (val === '超时') return 'text-[#F53F3F]'
  const ms = parseInt(val)
  if (isNaN(ms)) return 'text-text-2'
  if (ms <= 80) return 'text-[#00B42A]'
  if (ms <= 200) return 'text-[#FF7D00]'
  return 'text-[#F53F3F]'
}

export function maskText(text: string, enabled: boolean): string {
  if (!enabled || !text || text === '-') return text
  if (text.length <= 2) return `${text[0]}*`
  return text[0] + '*'.repeat(text.length - 2) + text[text.length - 1]
}

export function sortData(data: AssetRow[], key: SortKey, dir: SortDir): AssetRow[] {
  if (!dir) return data
  return [...data].sort((a, b) => {
    const av = a[key] ?? ''
    const bv = b[key] ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  })
}
