import Header from './components/layout/Header'
import ActivityBar from './components/layout/ActivityBar'
import Sidebar from './components/layout/Sidebar'
import TabBar from './components/tabs/TabBar'
import WorkspaceLayout from './components/workspace/WorkspaceLayout'
import ServerMonitor from './components/tabs/ServerMonitor'
import SftpPanel from './components/panels/SftpPanel'
import ServerInfoPanel from './components/panels/ServerInfoPanel'
import AssetToolbar from './components/assets/AssetToolbar'
import AssetTable from './components/assets/AssetTable'
import HiddenShortcuts from './components/assets/HiddenShortcuts'
import DirModal from './components/assets/DirModal'
import ContextMenu from './features/context-menu/ContextMenuShell'
import DialogRenderer from './features/dialogs/DialogRenderer'
import { ToastContainer } from './components/ui/toast'
import { AnimatePresence } from 'framer-motion'
import { useAssetStore } from './stores/useAssetStore'
import { useTabStore } from './stores/useTabStore'
import { useUIStore } from './stores/useUIStore'
import { TooltipProvider } from './components/ui/tooltip'
import { bootstrap } from './bootstrap'
import { useAppInit, useThemeEffect, useUIFontEffect, useZoomEffect, useAnimationEffect, useGlobalShortcuts, useConfigChangedListener, useWindowReady, useTabStatePersistence, useIdleLock, useWindowSizeEffect, useAutoSyncEffect } from './hooks/useAppEffects'
import DetachedTerminalView from './components/windows/DetachedTerminalView'
import LockScreen from './components/lock/LockScreen'

// 注册所有插槽模块
bootstrap()

// 检测 URL 参数决定渲染模式
const params = new URLSearchParams(window.location.search)
const detachMode = params.get('detach')
const detachConnectionId = params.get('id')
const detachTabId = params.get('tab')

export default function App() {
  // 独立终端窗口模式：跳过完整 App 布局
  if (detachMode === 'terminal' && detachConnectionId) {
    return <DetachedTerminalView connectionId={detachConnectionId} tabId={detachTabId ?? undefined} />
  }

  return <MainApp />
}

function MainApp() {
  const isAssetHidden = useAssetStore((s) => s.isAssetHidden)
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen)
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const sftpOpen = useUIStore((s) => s.sftpOpen)
  const serverPanelOpen = useUIStore((s) => s.serverPanelOpen)
  const isLocked = useUIStore((s) => s.isLocked)

  // 全局副作用
  useAppInit()
  useThemeEffect()
  useUIFontEffect()
  useZoomEffect()
  useAnimationEffect()
  useGlobalShortcuts()
  useConfigChangedListener()
  useTabStatePersistence()
  useIdleLock()
  useWindowReady()
  useWindowSizeEffect()
  useAutoSyncEffect()

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isListView = activeTab?.type === 'list'
  const isAssetView = activeTab?.type === 'asset'
  const isLocalTerminal = activeTab?.assetRow?.protocol === 'local'
  const isConnected = activeTab?.status === 'connected'

  return (
    <TooltipProvider delayDuration={300}>
    <div id="app-root" className="h-screen w-screen bg-bg-base font-sans flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        <div id="main-layout" className="flex-1 flex overflow-hidden pb-3 min-w-0 isolate">
          <ActivityBar />
          <Sidebar />

          <div id="main-content" className={`flex-1 flex flex-col bg-bg-card rounded-xl shadow-sm relative min-w-0 overflow-clip border ${isSidebarOpen ? 'ml-3' : ''} ${isAssetView ? 'dark:border-transparent border-border' : 'border-border'}`} onContextMenu={(e) => e.preventDefault()}>
            <TabBar />

            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0">
                {isListView && (
                  isAssetHidden ? <HiddenShortcuts /> : (
                    <>
                      <AssetToolbar />
                      <AssetTable />
                    </>
                  )
                )}

                {tabs.filter(t => t.type === 'asset').map(tab => (
                  <div
                    key={`${tab.id}-${tab.reconnectKey ?? 0}`}
                    className="flex-1 flex flex-col min-w-0"
                    style={{ display: activeTabId === tab.id ? 'flex' : 'none' }}
                  >
                    <WorkspaceLayout tab={tab} />
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {sftpOpen && <SftpPanel targetTabId={activeTabId} hidden={!(isAssetView && isConnected)} />}
              </AnimatePresence>
            </div>
          </div>

          {isAssetView && !isLocalTerminal && !serverPanelOpen && (
            <div className="shrink-0">
              <ServerMonitor connected={isConnected} tabId={activeTabId} />
            </div>
          )}

          {(!isAssetView || isLocalTerminal || serverPanelOpen) && <div className="w-3 shrink-0" />}
        </div>

        <AnimatePresence>
          {serverPanelOpen && isAssetView && !isLocalTerminal && <ServerInfoPanel />}
        </AnimatePresence>
      </div>

      <DirModal />
      <ContextMenu />
      <DialogRenderer />
      <ToastContainer />
      {isLocked && <LockScreen />}
    </div>
    </TooltipProvider>
  )
}
