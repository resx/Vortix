import { AppIcon, icons } from '../../icons/AppIcon'
import { ProtocolIcon } from '../../icons/ProtocolIcons'
import { getColorTagDotClass } from '../../../lib/color-tag'
import type { AppTab } from '../../../types'

interface DbDropdownProps {
  tabs: AppTab[]
  activeTabId: string
  menuRef: React.RefObject<HTMLDivElement | null>
  showMenu: boolean
  searchText: string
  selectedDbId: string | null
  setShowMenu: (visible: boolean) => void
  setSearchText: (value: string) => void
  setSelectedDbId: (id: string | null) => void
  openTabView: (tabId: string) => void
  closeTab: (tabId: string) => void
}

export function DbDropdown({
  tabs,
  activeTabId,
  menuRef,
  showMenu,
  searchText,
  selectedDbId,
  setShowMenu,
  setSearchText,
  setSelectedDbId,
  openTabView,
  closeTab,
}: DbDropdownProps) {
  const dbTabs = tabs.filter((t) => t.type !== 'list' && t.type !== 'asset')
  const selectedDb = selectedDbId ? dbTabs.find((t) => t.id === selectedDbId) ?? null : null
  const filteredDbTabs = dbTabs.filter((t) => !searchText || t.label.toLowerCase().includes(searchText.toLowerCase()))
  const showHome = !searchText || '首页'.includes(searchText)

  const handleNavigate = () => {
    if (selectedDb) {
      openTabView(selectedDb.id)
      return
    }
    openTabView('list')
  }

  return (
    <div ref={menuRef} className="relative h-full">
      <div className="h-full flex items-center rounded-tl-xl overflow-hidden">
        <button
          className="h-full px-3 flex items-center text-[12px] font-medium text-text-1 hover:bg-border/40 transition-colors"
          onClick={handleNavigate}
        >
          <span className="max-w-[120px] truncate">{selectedDb ? selectedDb.label : '列表'}</span>
        </button>
        <button
          className="h-full px-1.5 flex items-center hover:bg-border/40 transition-colors"
          onClick={() => setShowMenu(!showMenu)}
        >
          <AppIcon icon={icons.chevronDown} size={14} className={`text-text-3 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showMenu && (
        <div className="absolute top-full left-0 mt-1 bg-bg-card/75 backdrop-blur-2xl border border-bg-card/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] min-w-[200px] z-[300] overflow-hidden">
          <div className="px-3 pt-2.5 pb-1.5 text-[11px] text-text-3 font-medium tracking-wide">最近列表</div>
          <div className="h-px bg-border/60 mx-2" />
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-bg-base/80 rounded-lg">
              <AppIcon icon={icons.search} size={12} className="text-text-3 shrink-0" />
              <input
                type="text"
                placeholder="搜索..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="flex-1 bg-transparent text-[12px] text-text-1 placeholder-text-3 outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="h-px bg-border/60 mx-2" />

          <div className="py-1 max-h-[240px] overflow-y-auto custom-scrollbar">
            {showHome && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 mx-1.5 rounded-lg text-[12px] cursor-pointer transition-colors ${
                  activeTabId === 'list' ? 'bg-primary text-white' : 'text-text-1 hover:bg-bg-hover'
                }`}
                onClick={() => { setSelectedDbId(null); openTabView('list'); setShowMenu(false); setSearchText('') }}
              >
                <AppIcon icon={icons.home} size={14} className={activeTabId === 'list' ? 'text-white' : 'text-text-2'} />
                <span>首页</span>
              </div>
            )}

            {filteredDbTabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center gap-2 px-3 py-1.5 mx-1.5 rounded-lg text-[12px] cursor-pointer transition-colors group ${
                  activeTabId === tab.id ? 'bg-primary text-white' : 'text-text-1 hover:bg-bg-hover'
                }`}
                onClick={() => { setSelectedDbId(tab.id); openTabView(tab.id); setShowMenu(false); setSearchText('') }}
              >
                <ProtocolIcon protocol={tab.assetRow?.protocol} size={14} className={activeTabId === tab.id ? '!text-white' : ''} />
                {getColorTagDotClass(tab.assetRow?.colorTag) && (
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getColorTagDotClass(tab.assetRow?.colorTag)}`} />
                )}
                <span className="flex-1 truncate">{tab.label}</span>
                <button
                  className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${activeTabId === tab.id ? 'text-white/70 hover:text-white' : 'text-text-3 hover:text-text-1'}`}
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                >
                  <AppIcon icon={icons.close} size={12} />
                </button>
              </div>
            ))}

            {!showHome && filteredDbTabs.length === 0 && (
              <div className="px-3 py-3 text-[12px] text-text-3 text-center">无匹配结果</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
