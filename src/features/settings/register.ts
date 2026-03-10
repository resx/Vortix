/* ── 设置面板注册 ── */

import { registerSettingsPanels } from '../../registries/settings-panel.registry'
import BasicSettings from '../../components/settings/BasicSettings'
import SSHSettings from '../../components/settings/SSHSettings'
import DatabaseSettings from '../../components/settings/DatabaseSettings'
import SyncSettings from '../../components/settings/SyncSettings'

export function registerSettingsModules(): () => void {
  return registerSettingsPanels([
    { type: 'group', label: '通用' },
    { type: 'item', id: 'basic', label: '基础', component: BasicSettings },
    { type: 'item', id: 'ssh', label: 'SSH/SFTP', component: SSHSettings },
    { type: 'item', id: 'database', label: '数据库', component: DatabaseSettings },
    { type: 'group', label: '数据', mt: true },
    { type: 'item', id: 'sync', label: '数据同步', component: SyncSettings },
    { type: 'group', label: '快捷键', mt: true },
    { type: 'item', id: 'kb-basic', label: '基础' },
    { type: 'item', id: 'kb-ssh', label: 'SSH/SFTP' },
    { type: 'item', id: 'kb-database', label: '数据库' },
    { type: 'item', id: 'kb-docker', label: 'Docker' },
  ])
}
