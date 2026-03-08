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
import LocalTerminalConfigDialog from './components/local-terminal/LocalTerminalConfigDialog'
import QuickSearchDialog from './components/dialogs/QuickSearchDialog'
import UpdateDialog from './components/dialogs/UpdateDialog'
import ClearDataDialog from './components/dialogs/ClearDataDialog'
import ReloadConfirmDialog from './components/dialogs/ReloadConfirmDialog'
import ShortcutDialog from './components/dialogs/ShortcutDialog'
import { AnimatePresence } from 'framer-motion'
import { useAppStore } from './stores/useAppStore'
import { useSettingsStore } from './stores/useSettingsStore'
import { useTerminalProfileStore } from './stores/useTerminalProfileStore'
import { resolveFontChain } from './lib/fonts'
import { loadLocale } from './i18n'
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
  const localTermConfigOpen = useAppStore((s) => s.localTermConfigOpen)
  const quickSearchOpen = useAppStore((s) => s.quickSearchOpen)
  const updateDialogOpen = useAppStore((s) => s.updateDialogOpen)
  const clearDataDialogOpen = useAppStore((s) => s.clearDataDialogOpen)
  const reloadDialogOpen = useAppStore((s) => s.reloadDialogOpen)
  const shortcutDialogOpen = useAppStore((s) => s.shortcutDialogOpen)

  // 初始化：加载设置和资产数据
  useEffect(() => {
    Promise.all([
      useSettingsStore.getState().loadSettings(),
      useAppStore.getState().fetchAssets(),
      useAppStore.getState().fetchShortcuts(),
    ]).then(() => {
      // settings 加载完成后再加载 profiles（依赖 settings 数据）
      useTerminalProfileStore.getState().loadProfiles()
      // 加载 i18n 语言包
      const lang = useSettingsStore.getState().language
      loadLocale(lang)
    })

    // 检测 URL 参数 ?restore= 恢复标签页状态
    const params = new URLSearchParams(window.location.search)
    const restoreData = params.get('restore')
    if (restoreData) {
      try {
        const state = JSON.parse(restoreData)
        if (state.tabs && Array.isArray(state.tabs)) {
          // 恢复标签页（仅恢复列表和资产标签页的基本信息）
          for (const tab of state.tabs) {
            if (tab.type === 'asset' && tab.assetRow) {
              useAppStore.getState().openAssetTab(tab.assetRow)
            }
          }
        }
      } catch {
        // 解析失败静默忽略
      }
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname)
    }
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

  // 缩放比例 — 在 body 上应用 transform scale，覆盖所有 UI（含 portal 弹窗）
  const uiZoom = useSettingsStore((s) => s.uiZoom)
  useEffect(() => {
    const el = document.body
    const factor = uiZoom / 100
    if (factor === 1) {
      el.style.transform = ''
      el.style.transformOrigin = ''
      el.style.width = ''
      el.style.height = ''
    } else {
      el.style.transformOrigin = '0 0'
      el.style.transform = `scale(${factor})`
      el.style.width = `${100 / factor}vw`
      el.style.height = `${100 / factor}vh`
    }
  }, [uiZoom])

  // 动画开关
  const enableAnimation = useSettingsStore((s) => s.enableAnimation)
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !enableAnimation)
  }, [enableAnimation])

  // 全局快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        useAppStore.getState().toggleQuickSearch()
      }
      // Ctrl+W 关闭当前活跃标签页
      if (e.ctrlKey && !e.shiftKey && e.key === 'w') {
        e.preventDefault()
        const { activeTabId, closeTab } = useAppStore.getState()
        if (activeTabId !== 'list') closeTab(activeTabId)
      }
      // Ctrl+Shift+I/J 始终拦截（与终端快捷键冲突）
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) {
        e.preventDefault()
      }
      // F12：仅调试模式关闭时拦截（无快捷键冲突）
      if (e.key === 'F12' && !useSettingsStore.getState().debugMode) {
        e.preventDefault()
      }
      // Ctrl+Shift+C：拦截 Chrome 检查元素快捷键（终端复制已通过 JS 实现）
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault()
      }
      // 拦截原生缩放快捷键（Ctrl+加号/减号/0），用自定义缩放替代
      if (e.ctrlKey && !e.shiftKey && (e.key === '=' || e.key === '+' || e.key === '-' || e.key === '0')) {
        e.preventDefault()
        const { termZoomEnabled, uiZoom, updateSetting } = useSettingsStore.getState()
        if (!termZoomEnabled) return
        const step = 5
        if (e.key === '0') {
          if (uiZoom !== 100) updateSetting('uiZoom', 100)
        } else if (e.key === '=' || e.key === '+') {
          const next = Math.min(200, uiZoom + step)
          if (next !== uiZoom) updateSetting('uiZoom', next)
        } else {
          const next = Math.max(50, uiZoom - step)
          if (next !== uiZoom) updateSetting('uiZoom', next)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 非终端区域 Ctrl+Scroll → 全局 UI 缩放（拦截原生弹窗）
  // 终端区域的缩放由 SshTerminal 组件内部处理（只缩放字体）
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      // 终端区域内的事件由 SshTerminal 自行处理并 stopPropagation
      if ((e.target as HTMLElement).closest?.('.terminal-container')) return
      e.preventDefault()
      const { termZoomEnabled, uiZoom, updateSetting } = useSettingsStore.getState()
      if (!termZoomEnabled) return
      const step = 5
      const next = e.deltaY < 0 ? Math.min(200, uiZoom + step) : Math.max(50, uiZoom - step)
      if (next !== uiZoom) updateSetting('uiZoom', next)
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [])

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
        {/* 左侧主布局区域 */}
        <div id="main-layout" className="flex-1 flex overflow-hidden pb-3 min-w-0 isolate">
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
                    key={`${tab.id}-${tab.reconnectKey ?? 0}`}
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
          {isAssetView && !isLocalTerminal && !serverPanelOpen && (
            <div className="shrink-0">
              <ServerMonitor connected={isConnected} tabId={activeTabId} />
            </div>
          )}

          {/* 服务器面板关闭时的右侧间距（列表视图、本地终端或面板打开时） */}
          {(!isAssetView || isLocalTerminal || serverPanelOpen) && <div className="w-3 shrink-0" />}
        </div>

        {/* 服务器信息面板 - 与 app-root 同级扩展 */}
        <AnimatePresence>
          {serverPanelOpen && isAssetView && !isLocalTerminal && (
            <ServerInfoPanel />
          )}
        </AnimatePresence>
      </div>

      <DirModal />
      <ContextMenu />
      {settingsOpen && <SettingsPanel />}
      {sshConfigOpen && <SshConfigDialog />}
      {localTermConfigOpen && <LocalTerminalConfigDialog />}
      {quickSearchOpen && <QuickSearchDialog />}
      {updateDialogOpen && <UpdateDialog />}
      {clearDataDialogOpen && <ClearDataDialog />}
      {reloadDialogOpen && <ReloadConfirmDialog />}
      {shortcutDialogOpen && <ShortcutDialog />}
    </div>
    </TooltipProvider>
  )
}
