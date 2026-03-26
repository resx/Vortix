import { useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'

export function ModeTab({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
        active ? 'bg-primary text-white' : 'bg-bg-base text-text-2 hover:text-text-1'
      }`}
    >
      {label}
    </button>
  )
}

export function ProfileSelector({
  profiles,
  activeId,
  onChange,
  placeholder,
}: {
  profiles: { id: string; name: string }[]
  activeId: string
  onChange: (id: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const current = profiles.find((profile) => profile.id === activeId)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="island-control inline-flex h-[30px] min-w-[120px] items-center gap-1.5 px-2.5 text-[12px] text-text-1"
      >
        <span className="truncate">{current?.name ?? placeholder}</span>
        <AppIcon icon={icons.chevronDown} size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[1] cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-[2] mt-1 min-w-[160px] rounded-lg border border-border/60 bg-bg-card p-1 shadow-lg">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  onChange(profile.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center rounded-md px-3 py-1.5 text-left text-[12px] transition-colors ${
                  profile.id === activeId
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-1 hover:bg-bg-base'
                }`}
              >
                {profile.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-text-3">{label}</span>
      <span className="truncate text-right text-text-1">{value}</span>
    </div>
  )
}

export function ScoreCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-bg-card/30 px-3 py-2">
      <div className="text-[11px] text-text-3">{label}</div>
      <div className="mt-1 text-[18px] font-semibold text-text-1">{value}</div>
    </div>
  )
}

export function ColorInputField({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-text-3">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-bg-base px-2 py-2">
        <input
          type="color"
          value={(value && /^#[0-9a-fA-F]{6,8}$/.test(value)) ? value.slice(0, 7) : '#000000'}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-7 rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#RRGGBB"
          className="h-[28px] flex-1 bg-transparent text-[12px] text-text-1 outline-none placeholder:text-text-3"
        />
      </div>
    </label>
  )
}
