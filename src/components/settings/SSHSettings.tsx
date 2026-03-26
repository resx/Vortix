import { SSHSettingsAppearanceSection } from './ssh-settings/SSHSettingsAppearanceSection'
import { SSHSettingsConnectionSection } from './ssh-settings/SSHSettingsConnectionSection'
import { SSHSettingsSftpSection } from './ssh-settings/SSHSettingsSftpSection'
import { useSSHSettingsState } from './ssh-settings/useSSHSettingsState'

export default function SSHSettings() {
  const state = useSSHSettingsState()

  return (
    <>
      <SSHSettingsConnectionSection state={state} />
      <SSHSettingsAppearanceSection state={state} />
      <SSHSettingsSftpSection state={state} />
    </>
  )
}
