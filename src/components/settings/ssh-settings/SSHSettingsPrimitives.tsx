import { AppIcon } from '../../icons/AppIcon'
import { SettingRow } from '../SettingGroup'

export function NumberInput({
  value,
  onChange,
  width = 'w-[60px]',
}: {
  value: number
  onChange: (value: number) => void
  width?: string
}) {
  return (
    <input
      type="text"
      value={String(value)}
      onChange={(event) => {
        const num = parseFloat(event.target.value)
        if (!Number.isNaN(num)) onChange(num)
        else if (event.target.value === '') onChange(0)
      }}
      className={`${width} island-control px-2 text-right text-[12px]`}
    />
  )
}

export function CursorStylePicker({
  value,
  onChange,
}: {
  value: 'block' | 'underline' | 'bar'
  onChange: (value: 'block' | 'underline' | 'bar') => void
}) {
  const options: { value: 'block' | 'underline' | 'bar'; label: string }[] = [
    { value: 'block', label: 'Block' },
    { value: 'underline', label: 'Underline' },
    { value: 'bar', label: 'Bar' },
  ]

  return (
    <div className="flex items-center gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
            value === option.value ? 'bg-primary/10 text-primary' : 'text-text-2 hover:bg-border/60'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function DirectoryInputRow({
  label,
  value,
  placeholder,
  onPick,
  onChange,
  icon,
}: {
  label: string
  value: string
  placeholder: string
  onPick: () => Promise<void>
  onChange: (value: string) => void
  icon: string
}) {
  return (
    <SettingRow label={label}>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => void onPick()}
          className="island-btn flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full transition-colors"
        >
          <AppIcon icon={icon} size={13} className="text-text-2" />
        </button>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="island-control w-full max-w-[140px] px-2 text-[11px] placeholder-text-disabled"
        />
      </div>
    </SettingRow>
  )
}
