import { AppIcon, icons } from '../icons/AppIcon'
import { ProtocolIcon } from '../icons/ProtocolIcons'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { markTransferring, unmarkTransferring } from '../../stores/terminalSessionRegistry'
import { getColorTagDotClass } from '../../lib/color-tag'
import { useState, useRef, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

export default function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const createTabFromPane = useTabStore((s) => s.createTabFromPane)
  const reorderTab = useTabStore((s) => s.reorderTab)
  const showContextMenu = useUIStore((s) => s.showContextMenu)
  const sftpOpen = useUIStore((s) => s.sftpOpen)
  const toggleSftp = useUIStore((s) => s.toggleSftp)
  const closeLeft = !useSettingsStore((s) => s.tabCloseButtonLeft)
  const tabMultiLine = useSettingsStore((s) => s.tabMultiLine)
  const middleClickCloseTab = useSettingsStore((s) => s.middleClickCloseTab)

  const [showMenu, setShowMenu] = useState(false)
  const [searchText, setSearchText] = useState('')
  // 预留：当前选中的数据库 ID（数据库功能未实现，始终为 null）
  const [selectedDbId, setSelectedDbId] = useState<string | null>(null)
  const [dropHighlight, setDropHighlight] = useState(false)
  // 拖拽排序：记录插入指示位置
  const [dragIndicator, setDragIndicator] = useState<{ tabId: string; side: 'left' | 'right' } | null>(null)
  const dragSourceRef = useRef<string | null>(null)
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

  // 下拉菜单只跟踪数据库表（排除首页和 SSH 终端资产）
  const dbTabs = tabs.filter(t => t.type !== 'list' && t.type !== 'asset')

  // 当前选中的数据库标签
  const selectedDb = selectedDbId ? dbTabs.find(t => t.id === selectedDbId) ?? null : null

  // 点击文字区导航
  const handleNavigate = () => {
    if (selectedDb) {
      setActiveTab(selectedDb.id)
    } else {
      setActiveTab('list')
    }
  }

  // 搜索过滤
  const filteredDbTabs = dbTabs.filter(t =>
    !searchText || t.label.toLowerCase().includes(searchText.toLowerCase())
  )
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const showSftpAction = activeTab?.type === 'asset'
    && activeTab.assetRow?.protocol !== 'local'
    && activeTab.status === 'connected'
  const showHome = !searchText || '首页'.includes(searchText)

  return (
    <div id="tab-bar" className={`bg-bg-subtle rounded-t-xl flex items-center shrink-0 ${tabMultiLine ? 'min-h-[38px] flex-wrap' : 'h-[38px]'}`}>
      {/* 左上角下拉触发按钮 */}
      <div ref={menuRef} className="relative h-full">
        <div className="h-full flex items-center rounded-tl-xl overflow-hidden">
          {/* 文字区 - 点击导航到当前工作区 */}
          <button
            className="h-full px-3 flex items-center text-[12px] font-medium text-text-1 hover:bg-border/40 transition-colors"
            onClick={handleNavigate}
          >
            <span className="max-w-[120px] truncate">{selectedDb ? selectedDb.label : '列表'}</span>
          </button>
          {/* 箭头 - 切换下拉菜单 */}
          <button
            className="h-full px-1.5 flex items-center hover:bg-border/40 transition-colors"
            onClick={() => setShowMenu(!showMenu)}
          >
            <AppIcon icon={icons.chevronDown} size={14} className={`text-text-3 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
          </button>
        </div>

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
                  onClick={() => { setSelectedDbId(null); setActiveTab('list'); setShowMenu(false); setSearchText('') }}
                >
                  <AppIcon icon={icons.home} size={14} className={activeTabId === 'list' ? 'text-white' : 'text-text-2'} />
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
                  onClick={() => { setSelectedDbId(tab.id); setActiveTab(tab.id); setShowMenu(false); setSearchText('') }}
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
        className={`flex-1 flex items-center h-full transition-colors ${tabMultiLine ? 'flex-wrap' : 'overflow-x-auto'} ${dropHighlight ? 'border-b border-primary bg-primary/5' : ''}`}
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
        {(() => {
          const assetTabs = tabs.filter(t => t.type === 'asset')
          return assetTabs.map((tab, index) => {
            const isActive = activeTabId === tab.id
            const prevIsActive = index > 0 && activeTabId === assetTabs[index - 1].id

            // 关闭按钮
            const closeBtn = (
              <button
                className="shrink-0 p-0.5 rounded text-text-3/0 group-hover:text-text-3 hover:!text-text-1 hover:!bg-border/40 transition-all"
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              >
                <AppIcon icon={icons.close} size={12} />
              </button>
            )

            return (
              <div key={tab.id} className="flex items-center h-full">
                {/* 标签间分隔线：跳过第一个、活跃标签及其左邻 */}
                {index > 0 && !isActive && !prevIsActive && (
                  <div className="w-px h-3.5 bg-border/50 shrink-0" />
                )}
                <div
                  className={`group relative flex items-center gap-1.5 h-full text-[12px] cursor-pointer transition-colors ${
                    closeLeft ? 'pl-1.5 pr-2.5' : 'pl-2.5 pr-1.5'
                  } ${
                    isActive
                      ? 'font-medium text-text-1 bg-bg-card'
                      : 'text-text-3 hover:text-text-2 hover:bg-border/20'
                  }`}
                  draggable
                  onDragStart={(e) => {
                    dragSourceRef.current = tab.id
                    e.dataTransfer.setData('text/tab-id', tab.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => { dragSourceRef.current = null; setDragIndicator(null) }}
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes('text/tab-id')) return
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragSourceRef.current === tab.id) { setDragIndicator(null); return }
                    const rect = e.currentTarget.getBoundingClientRect()
                    const side = (e.clientX - rect.left) < rect.width / 2 ? 'left' : 'right'
                    setDragIndicator({ tabId: tab.id, side })
                  }}
                  onDragLeave={() => {
                    if (dragIndicator?.tabId === tab.id) setDragIndicator(null)
                  }}
                  onDrop={(e) => {
                    const fromId = e.dataTransfer.getData('text/tab-id')
                    if (fromId && fromId !== tab.id) {
                      e.preventDefault()
                      e.stopPropagation()
                      reorderTab(fromId, tab.id)
                    }
                    setDragIndicator(null)
                  }}
                  onClick={() => setActiveTab(tab.id)}
                  onMouseDown={(e) => {
                    if (e.button === 1 && middleClickCloseTab) {
                      e.preventDefault()
                      e.stopPropagation()
                      closeTab(tab.id)
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    showContextMenu(e.clientX, e.clientY, 'tab-context', { tabId: tab.id, tabIndex: index })
                  }}
                >
                  {/* 左侧插入指示器 */}
                  {dragIndicator?.tabId === tab.id && dragIndicator.side === 'left' && (
                    <div className="absolute left-0 top-[6px] bottom-[6px] w-[2px] bg-primary rounded-full" />
                  )}

                  {/* 关闭按钮 - 左侧 */}
                  {closeLeft && closeBtn}

                  <ProtocolIcon protocol={tab.assetRow?.protocol} size={12} />
                  {getColorTagDotClass(tab.assetRow?.colorTag) && (
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getColorTagDotClass(tab.assetRow?.colorTag)}`} />
                  )}
                  <span className="max-w-[80px] truncate">{tab.label}</span>

                  {/* 活动指示器：非活跃标签页有新输出时闪烁 */}
                  {!isActive && tab.hasActivity && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                  )}

                  {/* 关闭按钮 - 右侧 */}
                  {!closeLeft && closeBtn}

                  {/* 底部状态指示 */}
                  {isActive && (
                    <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-primary rounded-full" />
                  )}
                  {!isActive && tab.status === 'connecting' && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border overflow-hidden">
                      <div className="h-full bg-primary/50 animate-[loading_1.5s_ease-out_forwards]" />
                    </div>
                  )}
                  {!isActive && tab.status === 'connected' && (
                    <div className="absolute bottom-0 left-2 right-2 h-[1.5px] bg-text-3/25 rounded-full" />
                  )}

                  {/* 右侧插入指示器 */}
                  {dragIndicator?.tabId === tab.id && dragIndicator.side === 'right' && (
                    <div className="absolute right-0 top-[6px] bottom-[6px] w-[2px] bg-primary rounded-full" />
                  )}
                </div>
              </div>
            )
          })
        })()}
      </div>
      {showSftpAction && (
        <div className="flex h-full items-center gap-1 px-2 shrink-0 border-l border-border/50">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => toggleSftp()}
                className={`inline-flex h-[28px] w-[28px] items-center justify-center rounded-md transition-colors ${
                  sftpOpen
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-2 hover:bg-border/40 hover:text-text-1'
                }`}
              >
                <AppIcon icon={icons.folderOpen} size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{sftpOpen ? '关闭 SFTP 面板' : '打开 SFTP 面板'}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
