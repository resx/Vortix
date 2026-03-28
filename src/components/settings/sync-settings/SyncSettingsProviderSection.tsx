import { SettingGroup } from '../SettingGroup'
import { GitProviderFields } from './provider-section/GitProviderFields'
import { LocalProviderFields } from './provider-section/LocalProviderFields'
import { S3ProviderFields } from './provider-section/S3ProviderFields'
import { WebdavProviderFields } from './provider-section/WebdavProviderFields'
import type { SyncSettingsActions, SyncSettingsState } from './sync-settings-types'

interface SyncSettingsProviderSectionProps {
  state: SyncSettingsState
  actions: SyncSettingsActions
}

function resolveProviderTitle(repoSource: SyncSettingsState['repoSource']) {
  if (repoSource === 'git') return 'Git'
  if (repoSource === 'webdav') return 'WebDAV'
  if (repoSource === 's3') return 'S3'
  return '本地目录'
}

export function SyncSettingsProviderSection({ state, actions }: SyncSettingsProviderSectionProps) {
  return (
    <div className="mt-5">
      <div className="mb-3 text-[14px] font-medium text-text-1">{resolveProviderTitle(state.repoSource)}</div>
      <SettingGroup>
        {state.repoSource === 'local' && <LocalProviderFields state={state} actions={actions} />}
        {state.repoSource === 'git' && <GitProviderFields state={state} actions={actions} />}
        {state.repoSource === 'webdav' && <WebdavProviderFields state={state} actions={actions} />}
        {state.repoSource === 's3' && <S3ProviderFields state={state} actions={actions} />}
      </SettingGroup>
    </div>
  )
}
