import { type ReactNode } from 'react'

/* ── 设置行（弹性高度，窄窗口自适应） ── */
export function SettingRow({ label, desc, children }: {
  label: string
  desc?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex justify-between items-center px-4 min-h-[44px] py-2 gap-3 border-b border-border last:border-b-0">
      <span className="text-[12px] text-text-1 shrink-0 font-medium whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-2 justify-end flex-1 min-w-0">
        {desc && (
          typeof desc === 'string'
            ? <span className="text-[11px] text-text-3 truncate min-w-0">{desc}</span>
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
    <div className="self-start flex flex-col border border-border rounded-lg bg-bg-subtle shadow-[0_1px_2px_rgba(0,0,0,0.01)] min-w-0 max-w-full overflow-hidden">
      {children}
    </div>
  )
}
