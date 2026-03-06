import { ChevronDown, Home, Search, Terminal, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useWorkspaceStore, collectLeafIds } from '../../stores/useWorkspaceStore'
import { markTransferring, unmarkTransferring } from '../../stores/terminalSessionRegistry'
import { useState, useRef, useEffect } from 'react'

export default function TabBar() {
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const closeTab = useAppStore((s) => s.closeTab)
  const createTabFromPane = useAppStore((s) => s.createTabFromPane)

  const [showMenu, setShowMenu] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [dropHighlight, setDropHighlight] = useState(false)
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
    <div id="tab-bar" className="h-[38px] bg-bg-subtle rounded-t-xl flex items-center shrink-0">
      {/* 左上角下拉触发按钮 */}
      <div ref={menuRef} className="relative h-full">
        <button
          className="h-full px-3 flex items-center gap-1.5 text-[12px] font-medium text-text-1 hover:bg-border/40 rounded-tl-xl transition-colors"
          onClick={() => setShowMenu(!showMenu)}
        >
          <ChevronDown className={`w-3.5 h-3.5 text-text-3 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
          <span className="max-w-[120px] truncate">{activeTab?.type === 'list' ? '首页' : activeTab?.label ?? '首页'}</span>
        </button>

        {/* 下拉菜单 - 毛玻璃 */}
        {showMenu && (
          <div className="absolute top-full left-0 mt-1 bg-bg-card/75 backdrop-blur-2xl border border-bg-card/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] min-w-[200px] z-[300] overflow-hidden">
            {/* 标题行 */}
            <div className="px-3 pt-2.5 pb-1.5 text-[11px] text-text-3 font-medium tracking-wide">最近列表</div>

            {/* 分割线 */}
            <div className="h-px bg-border/60 mx-2" />

            {/* 搜索框 */}
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-bg-base/80 rounded-lg">
                <Search className="w-3 h-3 text-text-3 shrink-0" />
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

            {/* 分割线 */}
            <div className="h-px bg-border/60 mx-2" />

            {/* 列表内容 */}
            <div className="py-1 max-h-[240px] overflow-y-auto custom-scrollbar">
              {/* 首页 */}
              {showHome && (
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 mx-1.5 rounded-lg text-[12px] cursor-pointer transition-colors ${
                    activeTabId === 'list' ? 'bg-primary text-white' : 'text-text-1 hover:bg-bg-hover'
                  }`}
                  onClick={() => { setActiveTab('list'); setShowMenu(false); setSearchText('') }}
                >
                  <Home className={`w-3.5 h-3.5 ${activeTabId === 'list' ? 'text-white' : 'text-text-2'}`} />
                  <span>首页</span>
                </div>
              )}

              {/* 已打开的数据库表 / 资产终端 */}
              {filteredDbTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-3 py-1.5 mx-1.5 rounded-lg text-[12px] cursor-pointer transition-colors group ${
                    activeTabId === tab.id ? 'bg-primary text-white' : 'text-text-1 hover:bg-bg-hover'
                  }`}
                  onClick={() => { setActiveTab(tab.id); setShowMenu(false); setSearchText('') }}
                >
                  <Terminal className={`w-3.5 h-3.5 shrink-0 ${activeTabId === tab.id ? 'text-white' : 'text-icon-terminal'}`} />
                  <span className="flex-1 truncate">{tab.label}</span>
                  <button
                    className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ${activeTabId === tab.id ? 'text-white/70 hover:text-white' : 'text-text-3 hover:text-text-1'}`}
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* 空状态 */}
              {!showHome && filteredDbTabs.length === 0 && (
                <div className="px-3 py-3 text-[12px] text-text-3 text-center">无匹配结果</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 右侧标签指示区 - 显示当前活跃的资产标签状态，支持拖拽 */}
      <div
        className={`flex-1 flex items-center h-full border-b transition-colors ${dropHighlight ? 'border-primary bg-primary/5' : 'border-border'}`}
        onDragOver={(e) => {
          // 接受来自分屏面板的拖拽
          if (e.dataTransfer.types.includes('text/pane-id')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDropHighlight(true)
          }
        }}
        onDragLeave={() => setDropHighlight(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDropHighlight(false)
          const sourcePaneId = e.dataTransfer.getData('text/pane-id')
          const sourceTabId = e.dataTransfer.getData('text/source-tab-id')
          if (sourcePaneId && sourceTabId) {
            markTransferring(sourcePaneId)
            createTabFromPane(sourceTabId, sourcePaneId)
            setTimeout(() => unmarkTransferring(sourcePaneId), 100)
          }
        }}
      >
        {tabs.filter(t => t.type === 'asset').map((tab) => (
          <div
            key={tab.id}
            className={`relative flex items-center gap-1.5 px-3 h-full text-[12px] cursor-pointer transition-colors ${
              activeTabId === tab.id ? 'font-medium text-text-1' : 'text-text-3 hover:text-text-2'
            }`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/tab-id', tab.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <Terminal className="w-3 h-3" />
            <span className="max-w-[80px] truncate">{tab.label}</span>
            <button
              className="ml-0.5 text-text-3 hover:text-text-1"
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
            >
              <X className="w-3 h-3" />
            </button>

            {/* 底部状态指示 */}
            {tab.status === 'connecting' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border overflow-hidden">
                <div className="h-full bg-primary animate-[loading_1.5s_ease-out_forwards]" />
              </div>
            )}
            {tab.status === 'connected' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-text-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
