import type { ReturnTypeSettingsPanelState } from './settings-panel-types'

export function SettingsPanelSidebar({
  activeNav,
  setActiveNav,
  navData,
}: Pick<ReturnTypeSettingsPanelState, 'activeNav' | 'setActiveNav' | 'navData'>) {
  return (
    <div className="custom-scrollbar flex w-[196px] shrink-0 flex-col overflow-y-auto rounded-2xl border border-border/70 bg-bg-card/70 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm select-none">
      {navData.map((item, index) => {
        if (item.type === 'group') {
          return (
            <div
              key={index}
              className={`mb-1 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-3/90 ${'mt' in item && item.mt ? 'mt-3' : 'mt-1'}`}
            >
              {item.label}
            </div>
          )
        }

        const isActive = 'id' in item && item.id === activeNav
        return (
          <div
            key={index}
            onClick={() => {
              if ('id' in item) setActiveNav(item.id)
            }}
            className={`mx-1 mb-1 cursor-pointer rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all duration-200 ${
              'mt' in item && item.mt ? 'mt-2' : ''
            } ${
              isActive
                ? 'border-border bg-bg-card text-text-1 shadow-[0_8px_18px_rgba(64,128,255,0.14)]'
                : 'border-transparent text-text-2 hover:border-border/80 hover:bg-bg-hover/70'
            }`}
          >
            {item.label}
          </div>
        )
      })}
    </div>
  )
}
