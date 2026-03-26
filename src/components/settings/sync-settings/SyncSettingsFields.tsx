import { useState } from 'react'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { AppIcon, icons } from '../../icons/AppIcon'
import { Switch } from '../../ui/switch'
import { SettingRow } from '../SettingGroup'

export function EncryptionKeyRow() {
  const [visible, setVisible] = useState(false)
  const value = useSettingsStore((state) => state.syncEncryptionKey)
  const update = useSettingsStore((state) => state.updateSetting)

  return (
    <SettingRow label="加密密钥" desc="启用客户端加密后，导入和导出都需要使用相同密钥。">
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="island-btn flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full transition-colors"
        >
          {visible
            ? <AppIcon icon={icons.eyeOff} size={13} className="text-text-2" />
            : <AppIcon icon={icons.eye} size={13} className="text-text-2" />}
        </button>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => update('syncEncryptionKey', event.target.value)}
          placeholder="输入加密密钥"
          className="island-control w-full max-w-[240px] px-2 text-[11px]"
        />
      </div>
    </SettingRow>
  )
}

export function TlsToggleRow() {
  const value = useSettingsStore((state) => state.syncTlsVerify)
  const update = useSettingsStore((state) => state.updateSetting)

  return (
    <SettingRow label="TLS 校验" desc="验证 SSL 证书。">
      <Switch checked={value} onCheckedChange={() => update('syncTlsVerify', !value)} />
    </SettingRow>
  )
}
