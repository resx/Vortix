import { icons } from '../../icons/AppIcon'

export type NavId =
  | 'basic'
  | 'shortcuts-global'
  | 'sync'
  | 'ssh'
  | 'database'
  | 'docker'

export type ModuleTab = 'settings' | 'shortcuts'

export const NAV_GROUPS: Array<{
  id: 'global' | 'connections'
  label: string
  items: Array<{ id: NavId; label: string; icon: string }>
}> = [
  {
    id: 'global',
    label: '全局',
    items: [
      { id: 'basic', label: '基础设置', icon: icons.settings },
      { id: 'shortcuts-global', label: '快捷键', icon: icons.keyRound },
      { id: 'sync', label: '数据同步', icon: icons.cloud },
    ],
  },
  {
    id: 'connections',
    label: '连接与终端',
    items: [
      { id: 'ssh', label: 'SSH / SFTP', icon: icons.terminal },
      { id: 'database', label: '数据库', icon: icons.database },
      { id: 'docker', label: 'Docker', icon: icons.container },
    ],
  },
]

export function normalizeIncomingNav(nav: string): { id: NavId; tab?: ModuleTab } {
  switch (nav) {
    case 'basic':
    case 'sync':
    case 'ssh':
    case 'database':
    case 'docker':
    case 'shortcuts-global':
      return { id: nav }
    case 'kb-basic':
      return { id: 'shortcuts-global' }
    case 'kb-ssh':
      return { id: 'ssh', tab: 'shortcuts' }
    case 'kb-database':
      return { id: 'database', tab: 'shortcuts' }
    case 'kb-docker':
      return { id: 'docker', tab: 'shortcuts' }
    default:
      return { id: 'basic' }
  }
}

export function renderShortcutPlaceholder(scopeLabel: string) {
  return (
    <div className="rounded-2xl border border-border/70 bg-bg-card/72 p-5">
      <div className="text-[14px] font-medium text-text-1 mb-1">{scopeLabel}快捷键</div>
      <div className="text-[12px] text-text-3 leading-relaxed">当前版本暂未提供可视化快捷键编辑器。</div>
      <div className="text-[12px] text-text-3 leading-relaxed mt-1.5">
        该区域已预留，后续会接入完整的快捷键查询、冲突检测与重绑定能力。
      </div>
    </div>
  )
}
