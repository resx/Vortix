import Header from './components/layout/Header'
import ActivityBar from './components/layout/ActivityBar'
import Sidebar from './components/layout/Sidebar'
import TabBar from './components/tabs/TabBar'
import TerminalSimulation from './components/tabs/TerminalSimulation'
import ServerMonitor from './components/tabs/ServerMonitor'
import SftpPanel from './components/panels/SftpPanel'
import ServerInfoPanel from './components/panels/ServerInfoPanel'
import AssetToolbar from './components/assets/AssetToolbar'
import AssetTable from './components/assets/AssetTable'
import HiddenShortcuts from './components/assets/HiddenShortcuts'
import DirModal from './components/assets/DirModal'
import ContextMenu from './components/context-menu/ContextMenu'
import SettingsPanel from './components/settings/SettingsPanel'
import { AnimatePresence } from 'framer-motion'
import { useAppStore } from './stores/useAppStore'
import { TooltipProvider } from './components/ui/tooltip'

export default function App() {
  const isAssetHidden = useAppStore((s) => s.isAssetHidden)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const closeTab = useAppStore((s) => s.closeTab)
  const updateTabStatus = useAppStore((s) => s.updateTabStatus)
  const sftpOpen = useAppStore((s) => s.sftpOpen)
  const serverPanelOpen = useAppStore((s) => s.serverPanelOpen)
  const settingsOpen = useAppStore((s) => s.settingsOpen)

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isListView = activeTab?.type === 'list'
  const isAssetView = activeTab?.type === 'asset'
  const isConnected = activeTab?.status === 'connected'

  return (
    <TooltipProvider delayDuration={300}>
    <div id="app-root" className="h-screen w-screen bg-[#F2F3F5] font-sans flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧主布局区域 */}
        <div id="main-layout" className="flex-1 flex overflow-hidden pb-3 min-w-0">
          {/* ActivityBar - 紧贴左侧窗口边界 */}
          <ActivityBar />

          {/* Sidebar - 紧贴 ActivityBar 右侧 */}
          <Sidebar />

          {/* 主内容区 - 独立白色卡片 */}
          <div id="main-content" className="flex-1 flex flex-col bg-white rounded-xl border border-[#E5E6EB] shadow-sm relative min-w-0 ml-3 overflow-clip" onContextMenu={(e) => e.preventDefault()}>
            <TabBar />

            <div className="flex-1 flex overflow-hidden">
              {/* 内容区 */}
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

              {/* SFTP 面板 - 向左展开，压缩终端 */}
              <AnimatePresence>
                {isAssetView && sftpOpen && isConnected && (
                  <SftpPanel />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 右侧监控栏 - 类似左侧 ActivityBar，紧贴窗口右边界 */}
          {/* 服务器面板打开时隐藏，main-content 扩展到窗口边界 */}
          {isAssetView && !serverPanelOpen && (
            <div className="shrink-0">
              <ServerMonitor connected={isConnected} />
            </div>
          )}

          {/* 服务器面板关闭时的右侧间距（列表视图或面板打开时） */}
          {(!isAssetView || serverPanelOpen) && <div className="w-3 shrink-0" />}
        </div>

        {/* 服务器信息面板 - 与 app-root 同级扩展 */}
        <AnimatePresence>
          {serverPanelOpen && isAssetView && (
            <ServerInfoPanel />
          )}
        </AnimatePresence>
      </div>

      <DirModal />
      <ContextMenu />
      {settingsOpen && <SettingsPanel />}
    </div>
    </TooltipProvider>
  )
}
