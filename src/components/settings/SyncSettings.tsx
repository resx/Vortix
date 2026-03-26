import { SyncSettingsDialogs } from './sync-settings/SyncSettingsDialogs'
import { SyncSettingsOverviewSection } from './sync-settings/SyncSettingsOverviewSection'
import { SyncSettingsProviderSection } from './sync-settings/SyncSettingsProviderSection'
import { useSyncSettingsActions } from './sync-settings/useSyncSettingsActions'
import { useSyncSettingsState } from './sync-settings/useSyncSettingsState'

export default function SyncSettings() {
  const state = useSyncSettingsState()
  const actions = useSyncSettingsActions(state)

  return (
    <>
      <div className="mb-3 text-[16px] font-medium text-text-1">同步</div>
      <SyncSettingsOverviewSection state={state} actions={actions} />
      <SyncSettingsProviderSection state={state} actions={actions} />
      <SyncSettingsDialogs state={state} actions={actions} />
    </>
  )
}
