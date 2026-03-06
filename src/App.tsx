import { useEffect } from 'react'
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
import ContextMenu from './components/context-menu/ContextMenu'
import SettingsPanel from './components/settings/SettingsPanel'
import SshConfigDialog from './components/ssh-config/SshConfigDialog'
import { AnimatePresence } from 'framer-motion'
import { useAppStore } from './stores/useAppStore'
import { useSettingsStore } from './stores/useSettingsStore'
import { useTerminalProfileStore } from './stores/useTerminalProfileStore'
import { resolveFontChain } from './lib/fonts'
import { TooltipProvider } from './components/ui/tooltip'

export default function App() {
  const isAssetHidden = useAppStore((s) => s.isAssetHidden)
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen)
  const tabs = useAppStore((s) => s.tabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const sftpOpen = useAppStore((s) => s.sftpOpen)
  const serverPanelOpen = useAppStore((s) => s.serverPanelOpen)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const sshConfigOpen = useAppStore((s) => s.sshConfigOpen)

  // 初始化：加载设置和资产数据
  useEffect(() => {
    Promise.all([
      useSettingsStore.getState().loadSettings(),
      useAppStore.getState().fetchAssets(),
    ]).then(() => {
      // settings 加载完成后再加载 profiles（依赖 settings 数据）
      useTerminalProfileStore.getState().loadProfiles()
    })
  }, [])

  // 主题切换
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement

    // 主题切换时临时禁用所有 transition 防止闪烁
    root.classList.add('theme-switching')

    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // auto: 跟随系统
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => {
        root.classList.add('theme-switching')
        mq.matches ? root.classList.add('dark') : root.classList.remove('dark')
        requestAnimationFrame(() => {
          requestAnimationFrame(() => root.classList.remove('theme-switching'))
        })
      }
      apply()
      mq.addEventListener('change', apply)
      // 恢复 transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => root.classList.remove('theme-switching'))
      })
      return () => mq.removeEventListener('change', apply)
    }

    // 等待两帧后恢复 transition（确保所有样式已应用）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove('theme-switching'))
    })
  }, [theme])

  // UI 字体
  const uiFontFamily = useSettingsStore((s) => s.uiFontFamily)
  useEffect(() => {
    if (uiFontFamily.length === 0 || (uiFontFamily.length === 1 && uiFontFamily[0] === 'system')) {
      document.body.style.fontFamily = ''
    } else {
      document.body.style.fontFamily = resolveFontChain(uiFontFamily, 'system-ui, -apple-system, sans-serif')
    }
  }, [uiFontFamily])

  // 缩放比例
  const uiZoom = useSettingsStore((s) => s.uiZoom)
  useEffect(() => {
    ;(document.body.style as any).zoom = uiZoom === 100 ? '' : `${uiZoom}%`
  }, [uiZoom])

  // 动画开关
  const enableAnimation = useSettingsStore((s) => s.enableAnimation)
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !enableAnimation)
  }, [enableAnimation])

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isListView = activeTab?.type === 'list'
  const isAssetView = activeTab?.type === 'asset'
  const isConnected = activeTab?.status === 'connected'

  return (
    <TooltipProvider delayDuration={300}>
    <div id="app-root" className="h-screen w-screen bg-bg-base font-sans flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧主布局区域 */}
        <div id="main-layout" className="flex-1 flex overflow-hidden pb-3 min-w-0">
          {/* ActivityBar - 紧贴左侧窗口边界 */}
          <ActivityBar />

          {/* Sidebar - 紧贴 ActivityBar 右侧 */}
          <Sidebar />

          {/* 主内容区 - 独立白色卡片 */}
          <div id="main-content" className={`flex-1 flex flex-col bg-bg-card rounded-xl shadow-sm relative min-w-0 overflow-clip border ${isSidebarOpen ? 'ml-3' : ''} ${isAssetView ? 'dark:border-transparent border-border' : 'border-border'}`} onContextMenu={(e) => e.preventDefault()}>
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

                {/* 多标签并行渲染：所有 asset 标签同时挂载，通过 CSS 控制可见性 */}
                {tabs.filter(t => t.type === 'asset').map(tab => (
                  <div
                    key={tab.id}
                    className="flex-1 flex flex-col min-w-0"
                    style={{ display: activeTabId === tab.id ? 'flex' : 'none' }}
                  >
                    <WorkspaceLayout tab={tab} />
                  </div>
                ))}
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
      {sshConfigOpen && <SshConfigDialog />}
    </div>
    </TooltipProvider>
  )
}
