import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

interface SettingsDropdownProps {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  width?: string
}

export function SettingsDropdown({ value, options, onChange, width = 'w-auto' }: SettingsDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex items-center gap-1 cursor-pointer text-[#4E5969] hover:text-[#1F2329] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[13px]">{selectedLabel}</span>
        <ChevronDown size={14} />
      </div>

      {open && (
        <div
          className={`absolute right-0 top-full mt-1 bg-white border border-[#E5E6EB] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.12)] z-[1050] overflow-hidden flex flex-col ${width}`}
        >
          <div className="max-h-[240px] overflow-y-auto py-1 custom-scrollbar">
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`px-3 py-1.5 text-[13px] cursor-pointer transition-colors ${
                  opt.value === value
                    ? 'bg-[#E8F0FE] text-[#4080FF]'
                    : 'hover:bg-[#F2F3F5] text-[#1F2329]'
                }`}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
