import { useEffect, useRef, useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'

const PRESET_COLORS = ['#F53F3F', '#E6A23C', '#00B42A', '#4080FF', '#86909C', '#9A7ECC', '#D2B48C', '#00B4D8']

export function ColorDot({ color }: { color: string }) {
  return (
    <div
      className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
    />
  )
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="h-[28px] w-[28px] cursor-pointer rounded-md border border-border transition-transform hover:scale-105"
        style={{ backgroundColor: value }}
        title="选择颜色"
      />
      {open && (
        <div className="island-surface absolute bottom-9 right-0 z-10 mb-1 grid w-[120px] grid-cols-4 gap-1.5 rounded-lg p-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                onChange(color)
                setOpen(false)
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ backgroundColor: color }}
            >
              {value === color && <AppIcon icon={icons.check} size={10} className="text-white/80" />}
            </button>
          ))}
          <label className="relative flex h-5 w-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border bg-gradient-to-br from-red-500 via-green-500 to-blue-500 transition-transform hover:scale-110">
            <input
              type="color"
              value={value}
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              className="absolute inset-0 h-8 w-8 cursor-pointer opacity-0"
            />
          </label>
        </div>
      )}
    </div>
  )
}
