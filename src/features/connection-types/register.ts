/* ── 连接类型注册 ── */
/* 注册 16 种协议到连接类型注册表 */

import { registerConnectionType } from '../../registries/connection-type.registry'
import { useUIStore } from '../../stores/useUIStore'

export function registerConnectionTypes(): void {
  // SSH — 已实现
  registerConnectionType({
    protocol: 'ssh',
    label: 'SSH',
    useProtocolIcon: true,
    implemented: true,
    openConfig: (mode, id) => useUIStore.getState().openSshConfig(mode, id),
  })

  // 本地终端 — 已实现
  registerConnectionType({
    protocol: 'local',
    label: '本地终端',
    useProtocolIcon: true,
    implemented: true,
    openConfig: (mode, id) => useUIStore.getState().openLocalTermConfig(mode, id),
  })

  // 未实现的协议
  const unimplemented: { protocol: string; label: string; icon?: string; useProtocolIcon?: boolean }[] = [
    { protocol: 'ssh-tunnel', label: 'SSH隧道', useProtocolIcon: true },
    { protocol: 'telnet', label: 'Telnet', useProtocolIcon: true },
    { protocol: 'serial', label: '串口', useProtocolIcon: true },
    { protocol: 'rdp', label: 'RDP', useProtocolIcon: true },
    { protocol: 'docker', label: 'Docker', useProtocolIcon: true },
    { protocol: 'redis', label: 'Redis', useProtocolIcon: true },
    { protocol: 'mysql', label: 'MySQL', useProtocolIcon: true },
    { protocol: 'mariadb', label: 'MariaDB', useProtocolIcon: true },
    { protocol: 'postgresql', label: 'PostgreSQL', useProtocolIcon: true },
    { protocol: 'sqlserver', label: 'SqlServer', useProtocolIcon: true },
    { protocol: 'clickhouse', label: 'ClickHouse', useProtocolIcon: true },
    { protocol: 'sqlite', label: 'SQLite', useProtocolIcon: true },
    { protocol: 'oracle', label: 'Oracle', useProtocolIcon: true },
    { protocol: 'dameng', label: '达梦', useProtocolIcon: true },
  ]

  for (const item of unimplemented) {
    registerConnectionType({
      protocol: item.protocol,
      label: item.label,
      icon: item.icon,
      useProtocolIcon: item.useProtocolIcon,
      implemented: false,
    })
  }
}
