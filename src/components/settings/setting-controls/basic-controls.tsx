import { useSettingsStore, type SettingsState } from '../../../stores/useSettingsStore'
import { SettingsDropdown } from '../../ui/select'
import { Switch } from '../../ui/switch'
import { SettingRow } from '../SettingGroup'

export function SToggle({ k, label, desc }: { k: keyof SettingsState; label: string; desc?: string }) {
  const value = useSettingsStore((state) => state[k]) as boolean
  const update = useSettingsStore((state) => state.updateSetting)

  return (
    <SettingRow label={label} desc={desc}>
      <Switch checked={value} onCheckedChange={() => update(k, !value as never)} />
    </SettingRow>
  )
}

export function SDropdown({
  k,
  label,
  desc,
  options,
  width = 'w-[120px]',
}: {
  k: keyof SettingsState
  label: string
  desc?: string
  options: { value: string; label: string }[]
  width?: string
}) {
  const value = useSettingsStore((state) => state[k]) as string
  const update = useSettingsStore((state) => state.updateSetting)

  return (
    <SettingRow label={label} desc={desc}>
      <SettingsDropdown value={value} options={options} onChange={(next) => update(k, next as never)} width={width} />
    </SettingRow>
  )
}

export function SNumberDropdown({
  k,
  label,
  desc,
  options,
  width = 'w-[100px]',
}: {
  k: keyof SettingsState
  label: string
  desc?: string
  options: { value: number; label: string }[]
  width?: string
}) {
  const value = useSettingsStore((state) => state[k]) as number
  const update = useSettingsStore((state) => state.updateSetting)

  return (
    <SettingRow label={label} desc={desc}>
      <SettingsDropdown
        value={String(value)}
        options={options.map((option) => ({ value: String(option.value), label: option.label }))}
        onChange={(next) => update(k, Number(next) as never)}
        width={width}
      />
    </SettingRow>
  )
}

export function SNumberInput({
  k,
  label,
  desc,
  width = 'w-[60px]',
}: {
  k: keyof SettingsState
  label: string
  desc?: string
  width?: string
}) {
  const value = useSettingsStore((state) => state[k]) as number
  const update = useSettingsStore((state) => state.updateSetting)

  return (
    <SettingRow label={label} desc={desc}>
      <input
        type="text"
        value={String(value)}
        onChange={(event) => {
          const num = parseInt(event.target.value, 10)
          if (!Number.isNaN(num)) update(k, num as never)
          else if (event.target.value === '') update(k, 0 as never)
        }}
        className={`${width} island-control px-2 text-right text-[12px]`}
      />
    </SettingRow>
  )
}

export function STextInput({
  k,
  label,
  desc,
  width = 'w-[60px]',
  placeholder,
}: {
  k: keyof SettingsState
  label: string
  desc?: string
  width?: string
  placeholder?: string
}) {
  const value = useSettingsStore((state) => state[k]) as string
  const update = useSettingsStore((state) => state.updateSetting)

  return (
    <SettingRow label={label} desc={desc}>
      <input
        type="text"
        value={value}
        onChange={(event) => update(k, event.target.value as never)}
        placeholder={placeholder}
        className={`${width} island-control px-2 text-center text-[12px] placeholder-text-disabled`}
      />
    </SettingRow>
  )
}
