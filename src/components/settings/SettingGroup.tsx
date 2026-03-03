import { type ReactNode } from 'react'

/* ── Excel 风格设置行（固定 44px 行高，确保左右列分割线对齐） ── */
export function SettingRow({ label, desc, children }: {
  label: string
  desc?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex justify-between items-center px-4 h-[44px] whitespace-nowrap overflow-hidden gap-4 border-b border-[#E5E6EB] last:border-b-0">
      <span className="text-[12.5px] text-[#1F2329] shrink-0 font-medium">{label}</span>
      <div className="flex items-center gap-3 justify-end flex-1 min-w-0 pl-2">
        {desc && (
          typeof desc === 'string'
            ? <span className="text-[11.5px] text-[#86909C] truncate">{desc}</span>
            : desc
        )}
        <div className="shrink-0 flex items-center">{children}</div>
      </div>
    </div>
  )
}

/* ── Excel 风格设置分组容器 ── */
export function SettingGroup({ children }: { children: ReactNode }) {
  return (
    <div className="self-start flex flex-col border border-[#E5E6EB] rounded-lg bg-[#FAFAFA] shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
      {children}
    </div>
  )
}
