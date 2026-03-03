import type { TreeItem, AssetRow } from '../types'
import { Terminal } from 'lucide-react'

export const RECENT_PROJECTS = [
  { name: 'Huawei', icon: Terminal },
  { name: 'Bandwagon Megabox', icon: Terminal },
  { name: 'OVH KS-LE-B Ultra', icon: Terminal },
  { name: 'HostDZire', icon: Terminal },
  { name: 'RFC JP CO adv', icon: Terminal },
  { name: 'local', icon: Terminal },
  { name: 'RFC Jinx', icon: Terminal },
  { name: 'RFC JP T1', icon: Terminal },
  { name: 'RFC JP CO', icon: Terminal },
  { name: 'RFC JP2', icon: Terminal },
]

export const ASSETS_DATA: TreeItem[] = [
  { id: '1', name: 'Docker', type: 'folder', isOpen: true, children: [] },
  { id: '2', name: '业务', type: 'folder', isOpen: false, children: [] },
  { id: '3', name: '科学', type: 'folder', isOpen: false, children: [] },
  { id: '4', name: '远控', type: 'folder', isOpen: false, children: [] },
  { id: '5', name: '龟壳', type: 'folder', isOpen: false, children: [] },
]

export const SHORTCUTS_DATA: TreeItem[] = [
  { id: 'c1', name: '开发运营', type: 'folder', isOpen: true, children: [] },
  { id: 'c2', name: '系统管理员', type: 'folder', isOpen: false, children: [] },
  {
    id: 'c3', name: '网络工程师', type: 'folder', isOpen: true, children: [
      { id: 's1', name: 'dd脚本', type: 'connection' },
      { id: 's2', name: 'DMIT调优', type: 'connection' },
      { id: 's3', name: 'docker compose 更新', type: 'connection' },
      { id: 's4', name: 'mc连接存储桶服务', type: 'connection' },
    ],
  },
]

export const TABLE_DATA: AssetRow[] = [
  { id: 't1', name: 'Docker', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-12-16 23:57', expire: '-', remark: '-' },
  { id: 't2', name: '业务', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-09-30 19:31', expire: '-', remark: '-' },
  { id: 't3', name: '科学', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-09-30 19:31', expire: '-', remark: '-' },
  { id: 't4', name: '远控', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-09-30 19:31', expire: '-', remark: '-' },
  { id: 't5', name: '龟壳', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-09-30 19:45', expire: '-', remark: '-' },
  { id: 't6', name: 'web-prod-01', type: 'asset', latency: '12ms', host: '10.0.1.15', user: 'root', created: '2025-12-16 23:57', expire: '-', remark: '生产环境', folderName: '科学' },
  { id: 't7', name: 'db-master', type: 'asset', latency: '8ms', host: '10.0.2.10', user: 'admin', created: '2025-11-20 14:30', expire: '-', remark: '主数据库', folderName: '业务' },
  { id: 't8', name: 'proxy-hk-01', type: 'asset', latency: '35ms', host: '103.45.67.89', user: 'root', created: '2025-10-15 09:20', expire: '2026-10-15', remark: '香港节点', folderName: '龟壳' },
]

export const MOCK_HISTORY_CMDS = [
  { cmd: 'nvim docker-compose.yml', date: '2026-02-27 21:39' },
  { cmd: 'mkdir dock', date: '2026-02-27 21:41' },
  { cmd: 'cd docker/', date: '2026-02-27 21:42' },
  { cmd: 'curl -sL https://raw.githubu..', date: '2026-02-27 21:43' },
  { cmd: 'cd', date: '2026-02-27 21:45' },
  { cmd: 'docker compose up', date: '2026-02-27 21:45' },
  { cmd: 'cd docker/debian@ovh-leb:~/.d..', date: '2026-02-27 21:45' },
  { cmd: 'rm -rf watchtower-entrypoint..', date: '2026-02-27 21:45' },
  { cmd: 'cl', date: '2026-02-27 21:45' },
  { cmd: 'curl -fsSL https://raw.githu..', date: '2026-02-27 21:46' },
  { cmd: 'cat watchtower.Dockerfile', date: '2026-02-27 21:46' },
  { cmd: 'cd ..', date: '2026-02-27 21:46' },
  { cmd: 'docker compose up -d', date: '2026-02-27 21:46' },
  { cmd: 'cd typecho/', date: '2026-02-27 22:38' },
]
