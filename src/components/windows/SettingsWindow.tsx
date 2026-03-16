/* ── 设置独立窗口视图 ── */
/* 桌面端通过 settings.html 独立入口加载，模块图极小 */

import { useState, useEffect, useCallback } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen, emit } from '@tauri-apps/api/event'
import { useSettingsStore, buildSyncBody } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { getSettingsEntries, getSettingsComponent } from '../../registries/settings-panel.registry'
import { TooltipProvider } from '../ui/tooltip'
import WindowControls from '../../features/header/WindowControls'
import * as api from '../../api/client'
import { useThemeEffect, useUIFontEffect } from '../../hooks/useAppEffects'
import { handleTitleBarMouseDown, handleTitleBarDoubleClick } from '../../lib/window'
import { loadLocale } from '../../i18n'

export default function SettingsWindow() {
  const dirty = useSettingsStore((s) => s._dirty)
  const applySettings = useSettingsStore((s) => s.applySettings)
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults)

  const params = new URLSearchParams(window.location.search)
  const initialNav = params.get('nav') ?? 'basic'
  const [activeNav, setActiveNav] = useState(initialNav)
  const [syncTesting, setSyncTesting] = useState(false)
  const [syncTestResult, setSyncTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [ready, setReady] = useState(false)

  // 轻量初始化：并行加载设置窗口所需数据，API 失败时降级显示
  useEffect(() => {
    useSettingsStore.getState().loadSettings()
      .then(() => {
        const lang = useSettingsStore.getState().language
        return Promise.all([
          useTerminalProfileStore.getState().loadProfiles().catch(() => {}),
          useThemeStore.getState().loadCustomThemes().catch(() => {}),
          loadLocale(lang).catch(() => {}),
        ])
      })
      .catch(() => {
        // API 不可用，使用默认设置
      })
      .finally(() => setReady(true))
  }, [])

  // 监听主窗口发来的导航指令
  useEffect(() => {
    const unlisten = listen<string>('navigate-settings', (event) => {
      setActiveNav(event.payload)
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  // 数据就绪后再显示窗口，消除白屏闪烁
  useEffect(() => {
    if (!ready) return
    if (!('__TAURI_INTERNALS__' in window)) return
    requestAnimationFrame(() => {
      const win = getCurrentWindow()
      win.show().then(() => win.setFocus())
    })
  }, [ready])

  useThemeEffect()
  useUIFontEffect()

  const handleTestSync = useCallback(async () => {
    setSyncTesting(true)
    setSyncTestResult(null)
    try {
      await api.syncTest(buildSyncBody())
      setSyncTestResult({ ok: true, msg: '连接成功' })
    } catch (e) {
      setSyncTestResult({ ok: false, msg: (e as Error).message || '连接失败' })
    } finally {
      setSyncTesting(false)
    }
  }, [])

  const handleApply = useCallback(async () => {
    await applySettings()
    emit('config-changed', { source: 'settings' })
  }, [applySettings])

  // Ctrl+S 快捷保存
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (dirty) handleApply()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dirty, handleApply])

  const navData = getSettingsEntries()
  const ContentComponent = getSettingsComponent(activeNav)

  if (!ready) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-base text-text-3">
        加载中…
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="h-screen w-screen flex flex-col bg-bg-base text-text-0 overflow-hidden">
        {/* 标题栏 */}
        <div
          onMouseDown={handleTitleBarMouseDown}
          onDoubleClick={handleTitleBarDoubleClick}
          className="h-[48px] flex items-center justify-between px-4 shrink-0 select-none border-b border-border"
        >
          <span className="text-sm font-medium text-text-1">设置</span>
          <WindowControls />
        </div>

        {/* 主体 */}
        <div className="flex flex-1 min-h-0">
          {/* 侧边导航 */}
          <nav className="w-[180px] shrink-0 border-r border-border py-3 overflow-y-auto">
            {navData.map((entry, i) => {
              if (entry.type === 'group') {
                return (
                  <div
                    key={`g-${i}`}
                    className={`px-5 pt-4 pb-1 text-[11px] font-medium text-text-3 uppercase tracking-wider ${entry.mt ? 'mt-2' : ''}`}
                  >
                    {entry.label}
                  </div>
                )
              }
              const isActive = activeNav === entry.id
              return (
                <button
                  key={entry.id}
                  onClick={() => setActiveNav(entry.id)}
                  className={`w-full text-left px-5 py-1.5 text-[13px] transition-colors ${
                    isActive
                      ? 'text-primary bg-primary-bg font-medium'
                      : 'text-text-2 hover:text-text-1 hover:bg-bg-1'
                  }`}
                >
                  {entry.label}
                </button>
              )
            })}
          </nav>

          {/* 内容区 */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6">
            {ContentComponent ? (
              <ContentComponent />
            ) : (
              <div className="text-text-3 text-sm">未找到面板：{activeNav}</div>
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="h-[52px] flex items-center justify-between px-6 shrink-0 border-t border-border">
          <div className="flex items-center gap-2 text-[12px]">
            {activeNav === 'sync' && syncTestResult && (
              <span className={syncTestResult.ok ? 'text-status-success' : 'text-status-error'}>
                {syncTestResult.msg}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeNav === 'sync' && (
              <button
                onClick={handleTestSync}
                disabled={syncTesting}
                className="px-3 py-1.5 text-[13px] rounded border border-chart-green/40 bg-chart-green/15 text-chart-green hover:bg-chart-green/25 transition-colors disabled:opacity-50"
              >
                {syncTesting ? '测试中…' : '测试同步'}
              </button>
            )}
            <button
              onClick={resetToDefaults}
              className="px-3 py-1.5 text-[13px] rounded border border-border text-text-2 hover:bg-bg-1 transition-colors"
            >
              恢复默认
            </button>
            <button
              onClick={handleApply}
              disabled={!dirty}
              className="px-4 py-1.5 text-[13px] rounded bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              应用
            </button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
