import Header from './components/layout/Header'
import ActivityBar from './components/layout/ActivityBar'
import Sidebar from './components/layout/Sidebar'
import TabBar from './components/tabs/TabBar'
import TerminalSimulation from './components/tabs/TerminalSimulation'
import ServerMonitor from './components/tabs/ServerMonitor'
import AssetToolbar from './components/assets/AssetToolbar'
import AssetTable from './components/assets/AssetTable'
import HiddenShortcuts from './components/assets/HiddenShortcuts'
import DirModal from './components/assets/DirModal'
import ContextMenu from './components/context-menu/ContextMenu'
import { useAppStore } from './stores/useAppStore'

export default function App() {
  const isAssetHidden = useAppStore((s) => s.isAssetHidden)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const closeTab = useAppStore((s) => s.closeTab)
  const updateTabStatus = useAppStore((s) => s.updateTabStatus)

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isListView = activeTab?.type === 'list'
  const isAssetView = activeTab?.type === 'asset'

  return (
    <div id="app-root" className="h-screen w-screen bg-[#F2F3F5] font-sans flex flex-col overflow-hidden">
      <Header />

      <div id="main-layout" className="flex-1 flex overflow-hidden pr-3 pb-3">
        {/* ActivityBar - 紧贴左侧窗口边界 */}
        <ActivityBar />

        {/* Sidebar - 紧贴 ActivityBar 右侧 */}
        <Sidebar />

        {/* 主内容区 - 独立白色卡片 */}
        <div id="main-content" className="flex-1 flex flex-col bg-white rounded-xl border border-[#E5E6EB] shadow-sm relative min-w-0 ml-3 overflow-clip" onContextMenu={(e) => e.preventDefault()}>
          <TabBar />

          <div className="flex-1 flex overflow-hidden">
            {/* 左侧内容区 */}
            <div className="flex-1 flex flex-col min-w-0">
              {isListView && (
                isAssetHidden ? (
                  <HiddenShortcuts />
                ) : (
                  <>
                    <AssetToolbar />
                    <AssetTable />
                  </>
                )
              )}

              {isAssetView && activeTab?.assetRow && (
                <TerminalSimulation
                  asset={activeTab.assetRow}
                  onExit={() => closeTab(activeTab.id)}
                  setConnected={() => updateTabStatus(activeTab.id, 'connected')}
                />
              )}
            </div>

            {/* 右侧服务器监控面板 - 仅资产视图显示 */}
            {isAssetView && activeTab?.assetRow && (
              <ServerMonitor
                connected={activeTab.status === 'connected'}
              />
            )}
          </div>

          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 cursor-nwse-resize z-10">
            <svg viewBox="0 0 10 10" className="w-full h-full text-[#C9CDD4] fill-current">
              <polygon points="10,10 10,0 0,10" />
            </svg>
          </div>
        </div>
      </div>

      <DirModal />
      <ContextMenu />
    </div>
  )
}
