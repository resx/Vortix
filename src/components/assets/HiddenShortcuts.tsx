import { ChevronUp } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

const shortcuts = [
  { label: '全局搜索', keys: ['Ctrl', 'Shift', 'F'] },
  { label: '回到首页', keys: ['Alt', 'Home'] },
]

export default function HiddenShortcuts() {
  const setAssetHidden = useAppStore((s) => s.setAssetHidden)
  const setCurrentFolder = useAppStore((s) => s.setCurrentFolder)

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white">
      <div className="flex flex-col items-end gap-5 text-[13px] text-[#4E5969]">
        {shortcuts.map(({ label, keys }) => (
          <div key={label} className="flex items-center gap-6 w-[260px] justify-between">
            <span>{label}</span>
            <div className="flex gap-1.5">
              {keys.map((k) => (
                <kbd key={k} className="bg-white border border-[#C9CDD4] rounded-lg px-1.5 py-0.5 text-[11px] font-sans font-medium text-[#1F2329] shadow-sm">
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        className="mt-12 flex items-center gap-2 px-4 py-1.5 border border-[#C9CDD4] rounded-lg bg-white text-[#4E5969] text-[13px] font-medium hover:bg-[#F2F3F5] transition-colors shadow-sm"
        onClick={() => { setAssetHidden(false); setCurrentFolder(null) }}
      >
        <ChevronUp className="w-3.5 h-3.5" /> 显示资产列表
      </button>
    </div>
  )
}
