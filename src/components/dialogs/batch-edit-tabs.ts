/* ── 批量编辑 Tab 协议检测工具 ── */

export type BatchEditTab = 'general' | 'auth' | 'proxy' | 'env' | 'advanced'

export interface TabDef {
  key: BatchEditTab
  label: string
}

/** 全部 Tab 定义 */
const ALL_TABS: TabDef[] = [
  { key: 'general', label: '通用' },
  { key: 'auth', label: '认证' },
  { key: 'proxy', label: '代理' },
  { key: 'env', label: '环境变量' },
  { key: 'advanced', label: '高级' },
]

/** 各协议支持的 Tab（预留 Docker/Database 扩展） */
const PROTOCOL_TABS: Record<string, BatchEditTab[]> = {
  ssh: ['general', 'auth', 'proxy', 'env', 'advanced'],
  local: ['general'],
  // docker: ['general', 'auth', 'env'],
  // database: ['general', 'auth'],
}

/** 根据选中资产的协议列表，返回所有协议共有的 Tab */
export function getAvailableTabs(protocols: string[]): TabDef[] {
  if (protocols.length === 0) return ALL_TABS.filter(t => t.key === 'general')

  const unique = [...new Set(protocols)]
  // 取所有协议的 Tab 交集
  const sets = unique.map(p => new Set(PROTOCOL_TABS[p] ?? ['general']))
  const intersection = sets.reduce((acc, s) => {
    return new Set([...acc].filter(t => s.has(t)))
  })

  return ALL_TABS.filter(t => intersection.has(t.key))
}

/** 返回协议摘要文本，如 "5 条 SSH 连接" 或 "3 条 SSH + 2 条本地终端" */
export function getProtocolSummary(protocols: string[]): string {
  const counts = new Map<string, number>()
  for (const p of protocols) {
    counts.set(p, (counts.get(p) ?? 0) + 1)
  }

  const labels: Record<string, string> = {
    ssh: 'SSH',
    local: '本地终端',
    docker: 'Docker',
    database: '数据库',
    sftp: 'SFTP',
    rdp: 'RDP',
  }

  const parts = [...counts.entries()].map(
    ([p, n]) => `${n} 条${labels[p] ?? p}`
  )
  return parts.join(' + ')
}
