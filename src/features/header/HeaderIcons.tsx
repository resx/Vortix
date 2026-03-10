/* ── Header 自定义 SVG 图标 + 工具按钮 ── */

export function TransferIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 0 0 20" strokeDasharray="4 4" />
      <path d="M12 2a10 10 0 0 1 0 20" />
      <path d="M12 8v8M8 12l4 4 4-4" />
    </svg>
  )
}

export function BroadcastIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M8 8a6 6 0 0 1 8 0" />
      <path d="M8 16a6 6 0 0 0 8 0" />
      <path d="M5 5a10 10 0 0 1 14 0" />
      <path d="M5 19a10 10 0 0 0 14 0" />
    </svg>
  )
}

export function CloudClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <circle cx="15" cy="14" r="3" fill="var(--bg-card, #fff)" stroke="currentColor" />
      <path d="M15 12.5v1.5l1 1" stroke="currentColor" />
    </svg>
  )
}

export function HeaderTopButton({ icon: Icon, onClick, tooltip, isActive = false }: {
  icon: React.ComponentType<{ className?: string }>
  onClick?: (e: React.MouseEvent) => void
  tooltip?: string
  isActive?: boolean
}) {
  return (
    <div className="group/topbtn relative flex items-center justify-center">
      <button
        onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
        className={`transition-colors p-1 rounded ${isActive ? 'text-primary bg-primary-bg' : 'text-text-2 hover:text-text-1 hover:bg-border/50'}`}
      >
        <Icon className="w-[15px] h-[15px]" />
      </button>
      {tooltip && (
        <div className="absolute top-full mt-[8px] hidden group-hover/topbtn:flex items-center flex-col z-[200]">
          <div className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-tooltip-bg" />
          <div className="bg-tooltip-bg text-tooltip-text text-[12px] px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-xl font-medium tracking-wide leading-none">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  )
}
