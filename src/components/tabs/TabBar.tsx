import { AppIcon, icons } from '../icons/AppIcon'
import { useTabStore } from '../../stores/useTabStore'
import { useUIStore } from '../../stores/useUIStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { markTransferring, unmarkTransferring } from '../../stores/terminalSessionRegistry'
import { useState, useRef, useEffect } from 'react'
import { DbDropdown } from './tab-bar/DbDropdown'
import { AssetTabStrip } from './tab-bar/AssetTabStrip'

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

  const openTabView = (tabId: string) => {
    if (sftpOpen) toggleSftp()
    setActiveTab(tabId)
  }

  const toggleFileManager = () => {
    if (sftpOpen) {
      toggleSftp()
      setActiveTab('list')
      return
    }
    toggleSftp()
  }

  return (
    <div id="tab-bar" className={`bg-bg-subtle rounded-t-xl flex items-center shrink-0 ${tabMultiLine ? 'min-h-[38px] flex-wrap' : 'h-[38px]'}`}>
      {/* 左上角下拉触发按钮 */}
      <DbDropdown
        tabs={tabs}
        activeTabId={activeTabId}
        menuRef={menuRef}
        showMenu={showMenu}
        searchText={searchText}
        selectedDbId={selectedDbId}
        setShowMenu={setShowMenu}
        setSearchText={setSearchText}
        setSelectedDbId={setSelectedDbId}
        openTabView={openTabView}
        closeTab={closeTab}
      />

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
        <div className="flex items-center h-full">
          <div
            className={`group relative flex items-center gap-1.5 h-full text-[12px] cursor-pointer transition-colors pl-2.5 pr-2.5 ${
              sftpOpen
                ? 'font-medium text-text-1 bg-bg-card'
                : 'text-text-3 hover:text-text-2 hover:bg-border/20'
            }`}
            onClick={toggleFileManager}
          >
            <AppIcon icon={icons.folderOpen} size={13} />
            <span className="max-w-[96px] truncate">文件管理</span>
            {sftpOpen && (
              <div className="absolute bottom-0 left-1 right-1 h-[2px] bg-primary rounded-full" />
            )}
          </div>
          <div className="w-px h-3.5 bg-border/50 shrink-0" />
        </div>

        <AssetTabStrip
          tabs={tabs}
          activeTabId={activeTabId}
          closeLeft={closeLeft}
          middleClickCloseTab={middleClickCloseTab}
          dragSourceRef={dragSourceRef}
          dragIndicator={dragIndicator}
          setDragIndicator={setDragIndicator}
          closeTab={closeTab}
          openTabView={openTabView}
          reorderTab={reorderTab}
          showContextMenu={showContextMenu}
        />
      </div>
    </div>
  )
}
