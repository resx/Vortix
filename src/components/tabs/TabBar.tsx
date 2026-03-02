import { ChevronDown, Home, Search, Terminal, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useState, useRef, useEffect } from 'react'

export default function TabBar() {
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const closeTab = useAppStore((s) => s.closeTab)

  const [showMenu, setShowMenu] = useState(false)
  const [searchText, setSearchText] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  const activeTab = tabs.find(t => t.id === activeTabId)
  const dbTabs = tabs.filter(t => t.type === 'asset')

  // 搜索过滤
  const filteredDbTabs = dbTabs.filter(t =>
    !searchText || t.label.toLowerCase().includes(searchText.toLowerCase())
  )
  const showHome = !searchText || '首页'.includes(searchText)

  return (
    <div id="tab-bar" className="h-[38px] bg-[#F7F8FA] rounded-t-xl flex items-center shrink-0">
      {/* 左上角下拉触发按钮 */}
      <div ref={menuRef} className="relative h-full">
        <button
          className="h-full px-3 flex items-center gap-1.5 text-[12px] font-medium text-[#1F2329] hover:bg-[#E5E6EB]/40 rounded-tl-xl transition-colors"
          onClick={() => setShowMenu(!showMenu)}
        >
          <ChevronDown className={`w-3.5 h-3.5 text-[#86909C] transition-transform ${showMenu ? 'rotate-180' : ''}`} />
          <span className="max-w-[120px] truncate">{activeTab?.type === 'list' ? '首页' : activeTab?.label ?? '首页'}</span>
        </button>

        {/* 下拉菜单 - 毛玻璃 */}
        {showMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white/75 backdrop-blur-2xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] min-w-[200px] z-[300] overflow-hidden">
            {/* 标题行 */}
            <div className="px-3 pt-2.5 pb-1.5 text-[11px] text-[#86909C] font-medium tracking-wide">最近列表</div>

            {/* 分割线 */}
            <div className="h-px bg-[#E5E6EB]/60 mx-2" />

            {/* 搜索框 */}
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-[#F2F3F5]/80 rounded-lg">
                <Search className="w-3 h-3 text-[#86909C] shrink-0" />
                <input
                  type="text"
                  placeholder="搜索..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="flex-1 bg-transparent text-[12px] text-[#1F2329] placeholder-[#86909C] outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* 分割线 */}
            <div className="h-px bg-[#E5E6EB]/60 mx-2" />

            {/* 列表内容 */}
            <div className="py-1 max-h-[240px] overflow-y-auto custom-scrollbar">
              {/* 首页 */}
              {showHome && (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 mx-1.5 rounded-lg text-[12px] cursor-pointer transition-colors ${
                    activeTabId === 'list' ? 'bg-[#4080FF] text-white' : 'text-[#1F2329] hover:bg-[#F2F3F5]'
                  }`}
                  onClick={() => { setActiveTab('list'); setShowMenu(false); setSearchText('') }}
                >
                  <Home className={`w-3.5 h-3.5 ${activeTabId === 'list' ? 'text-white' : 'text-[#4E5969]'}`} />
                  <span>首页</span>
                </div>
              )}

              {/* 已打开的数据库表 / 资产终端 */}
              {filteredDbTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-3 py-1.5 mx-1.5 rounded-lg text-[12px] cursor-pointer transition-colors group ${
                    activeTabId === tab.id ? 'bg-[#4080FF] text-white' : 'text-[#1F2329] hover:bg-[#F2F3F5]'
                  }`}
                  onClick={() => { setActiveTab(tab.id); setShowMenu(false); setSearchText('') }}
                >
                  <Terminal className={`w-3.5 h-3.5 shrink-0 ${activeTabId === tab.id ? 'text-white' : 'text-[#409EFF]'}`} />
                  <span className="flex-1 truncate">{tab.label}</span>
                  <button
                    className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${activeTabId === tab.id ? 'text-white/70 hover:text-white' : 'text-[#86909C] hover:text-[#1F2329]'}`}
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* 空状态 */}
              {!showHome && filteredDbTabs.length === 0 && (
                <div className="px-3 py-3 text-[12px] text-[#86909C] text-center">无匹配结果</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 右侧标签指示区 - 显示当前活跃的资产标签状态 */}
      <div className="flex-1 flex items-center h-full border-b border-[#E5E6EB]">
        {tabs.filter(t => t.type === 'asset').map((tab) => (
          <div
            key={tab.id}
            className={`relative flex items-center gap-1.5 px-3 h-full text-[12px] cursor-pointer transition-colors ${
              activeTabId === tab.id ? 'font-medium text-[#1F2329]' : 'text-[#86909C] hover:text-[#4E5969]'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Terminal className="w-3 h-3" />
            <span className="max-w-[80px] truncate">{tab.label}</span>
            <button
              className="ml-0.5 text-[#86909C] hover:text-[#1F2329]"
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
            >
              <X className="w-3 h-3" />
            </button>

            {/* 底部状态指示 */}
            {tab.status === 'connecting' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E5E6EB] overflow-hidden">
                <div className="h-full bg-[#4080FF] animate-[loading_1.5s_ease-out_forwards]" />
              </div>
            )}
            {tab.status === 'connected' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1F2329]" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
