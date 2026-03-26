import { useState } from 'react'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { AppIcon, icons } from '../../icons/AppIcon'
import { Switch } from '../../ui/switch'
import { SettingRow } from '../SettingGroup'

export function LockPasswordRow() {
  const [visible, setVisible] = useState(false)
  const value = useSettingsStore((state) => state.lockPassword)
  const update = useSettingsStore((state) => state.updateSetting)
  const iconName = visible ? icons.eyeOff : icons.eye

  return (
    <SettingRow label="锁屏密码">
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="island-btn flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full transition-colors"
        >
          <AppIcon icon={iconName} size={13} className="text-text-2" />
        </button>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => update('lockPassword', event.target.value)}
          className="island-control w-full max-w-[140px] px-2 text-[12px]"
        />
      </div>
    </SettingRow>
  )
}

export function TabCloseButtonSideRow() {
  const value = useSettingsStore((state) => state.tabCloseButtonLeft)
  const update = useSettingsStore((state) => state.updateSetting)

  return (
    <SettingRow label="Tab 关闭按钮位置" desc={value ? '左侧' : '右侧'}>
      <Switch checked={value} onCheckedChange={() => update('tabCloseButtonLeft', !value)} />
    </SettingRow>
  )
}
