/* 独立设置窗口（settings.html 入口） */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen, emit, emitTo } from '@tauri-apps/api/event'
import { AppIcon, icons } from '../icons/AppIcon'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { getSettingsComponent } from '../../registries/settings-panel.registry'
import { TooltipProvider } from '../ui/tooltip'
import WindowControls from '../../features/header/WindowControls'
import { useThemeEffect, useUIFontEffect } from '../../hooks/useAppEffects'
import { shouldBlockTabFocusNavigation } from '../../lib/focus-tab-policy'
import { handleTitleBarMouseDown, handleTitleBarDoubleClick } from '../../lib/window'
import { loadLocale } from '../../i18n'

type NavId =
  | 'basic'
  | 'shortcuts-global'
  | 'sync'
  | 'ssh'
  | 'database'
  | 'docker'

type ModuleTab = 'settings' | 'shortcuts'

const NAV_GROUPS: Array<{
  id: 'global' | 'connections'
  label: string
  items: Array<{ id: NavId; label: string; icon: string }>
}> = [
  {
    id: 'global',
    label: '全局',
    items: [
      { id: 'basic', label: '基础设置', icon: icons.settings },
      { id: 'shortcuts-global', label: '快捷键', icon: icons.keyRound },
      { id: 'sync', label: '数据同步', icon: icons.cloud },
    ],
  },
  {
    id: 'connections',
    label: '连接与终端',
    items: [
      { id: 'ssh', label: 'SSH / SFTP', icon: icons.terminal },
      { id: 'database', label: '数据库', icon: icons.database },
      { id: 'docker', label: 'Docker', icon: icons.container },
    ],
  },
]

function normalizeIncomingNav(nav: string): { id: NavId; tab?: ModuleTab } {
  switch (nav) {
    case 'basic':
    case 'sync':
    case 'ssh':
    case 'database':
    case 'docker':
    case 'shortcuts-global':
      return { id: nav }
    case 'kb-basic':
      return { id: 'shortcuts-global' }
    case 'kb-ssh':
      return { id: 'ssh', tab: 'shortcuts' }
    case 'kb-database':
      return { id: 'database', tab: 'shortcuts' }
    case 'kb-docker':
      return { id: 'docker', tab: 'shortcuts' }
    default:
      return { id: 'basic' }
  }
}

function renderShortcutPlaceholder(scopeLabel: string) {
  return (
    <div className="rounded-2xl border border-border/70 bg-bg-card/72 p-5">
      <div className="text-[14px] font-medium text-text-1 mb-1">{scopeLabel}快捷键</div>
      <div className="text-[12px] text-text-3 leading-relaxed">
        当前版本暂未提供可视化快捷键编辑器。
      </div>
      <div className="text-[12px] text-text-3 leading-relaxed mt-1.5">
        该区域已预留，后续会接入完整的快捷键查询、冲突检测与重绑定能力。
      </div>
    </div>
  )
}

export default function SettingsWindow() {
  const dirty = useSettingsStore((s) => s._dirty)
  const applySettings = useSettingsStore((s) => s.applySettings)
  const loadSettings = useSettingsStore((s) => s.loadSettings)

  const params = new URLSearchParams(window.location.search)
  const initial = normalizeIncomingNav(params.get('nav') ?? 'basic')
  const [activeNav, setActiveNav] = useState<NavId>(initial.id)
  const [moduleTabs, setModuleTabs] = useState<Record<'ssh' | 'database' | 'docker', ModuleTab>>({
    ssh: initial.id === 'ssh' && initial.tab ? initial.tab : 'settings',
    database: initial.id === 'database' && initial.tab ? initial.tab : 'settings',
    docker: initial.id === 'docker' && initial.tab ? initial.tab : 'shortcuts',
  })
  const [ready, setReady] = useState(false)
  const [saveIndicatorMode, setSaveIndicatorMode] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveIndicatorVisible, setSaveIndicatorVisible] = useState(false)
  const [saveIndicatorFading, setSaveIndicatorFading] = useState(false)
  const saveFadeTimerRef = useRef<number | null>(null)
  const saveHideTimerRef = useRef<number | null>(null)

  useEffect(() => {
    loadSettings()
      .then(() => {
        const lang = useSettingsStore.getState().language
        return Promise.all([
          useTerminalProfileStore.getState().loadProfiles().catch(() => {}),
          useThemeStore.getState().loadCustomThemes().catch(() => {}),
          loadLocale(lang).catch(() => {}),
        ])
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [loadSettings])

  useEffect(() => {
    const unlisten = listen<string>('navigate-settings', (event) => {
      const parsed = normalizeIncomingNav(event.payload)
      setActiveNav(parsed.id)
      if (parsed.tab && (parsed.id === 'ssh' || parsed.id === 'database' || parsed.id === 'docker')) {
        setModuleTabs((prev) => ({ ...prev, [parsed.id]: parsed.tab }))
      }
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  useEffect(() => {
    const unlisten = listen<{ source?: string }>('config-changed', (event) => {
      if (event.payload?.source === 'settings') return
      void loadSettings().then(() => {
        const lang = useSettingsStore.getState().language
        return Promise.all([
          useTerminalProfileStore.getState().loadProfiles().catch(() => {}),
          useThemeStore.getState().loadCustomThemes().catch(() => {}),
          loadLocale(lang).catch(() => {}),
        ])
      })
    })
    return () => { unlisten.then(fn => fn()) }
  }, [loadSettings])

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

  const handleApply = useCallback(async () => {
    await applySettings()
    const payload = { source: 'settings' }
    await emit('config-changed', payload)
    if ('__TAURI_INTERNALS__' in window) {
      await emitTo('main', 'config-changed', payload)
    }
  }, [applySettings])

  const clearSaveIndicatorTimers = useCallback(() => {
    if (saveFadeTimerRef.current !== null) {
      window.clearTimeout(saveFadeTimerRef.current)
      saveFadeTimerRef.current = null
    }
    if (saveHideTimerRef.current !== null) {
      window.clearTimeout(saveHideTimerRef.current)
      saveHideTimerRef.current = null
    }
  }, [])

  const handleCloseWindow = useCallback(async () => {
    if (!('__TAURI_INTERNALS__' in window)) {
      window.close()
      return
    }

    const win = getCurrentWindow()
    try {
      await win.close()
      await new Promise((resolve) => window.setTimeout(resolve, 80))
      const stillVisible = await win.isVisible().catch(() => false)
      if (!stillVisible) return
    } catch {
      // fallback below
    }

    try {
      await win.hide()
      return
    } catch {
      // fallback below
    }

    const maybeDestroy = win as unknown as { destroy?: () => Promise<void> }
    if (typeof maybeDestroy.destroy === 'function') {
      await maybeDestroy.destroy().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!ready || !dirty) return
    const timer = window.setTimeout(async () => {
      clearSaveIndicatorTimers()
      setSaveIndicatorVisible(true)
      setSaveIndicatorFading(false)
      setSaveIndicatorMode('saving')
      await handleApply()
      setSaveIndicatorMode('saved')
      saveFadeTimerRef.current = window.setTimeout(() => {
        setSaveIndicatorFading(true)
      }, 2200)
      saveHideTimerRef.current = window.setTimeout(() => {
        setSaveIndicatorVisible(false)
        setSaveIndicatorFading(false)
        setSaveIndicatorMode('idle')
      }, 2500)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [clearSaveIndicatorTimers, dirty, handleApply, ready])

  useEffect(() => {
    return () => clearSaveIndicatorTimers()
  }, [clearSaveIndicatorTimers])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldBlockTabFocusNavigation(e)) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (dirty) void handleApply()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dirty, handleApply])

  const BasicComp = getSettingsComponent('basic')
  const SyncComp = getSettingsComponent('sync')
  const SshComp = getSettingsComponent('ssh')
  const DbComp = getSettingsComponent('database')

  const activeItem = NAV_GROUPS.flatMap((g) => g.items).find((item) => item.id === activeNav)
  const activeLabel = activeItem?.label ?? '设置'
  const isModuleNav = activeNav === 'ssh' || activeNav === 'database' || activeNav === 'docker'
  const moduleTab = isModuleNav ? moduleTabs[activeNav] : null

  const renderContent = () => {
    if (activeNav === 'basic') {
      return BasicComp ? <BasicComp /> : <div className="text-text-3 text-sm">基础设置面板未注册</div>
    }
    if (activeNav === 'sync') {
      return SyncComp ? <SyncComp /> : <div className="text-text-3 text-sm">数据同步面板未注册</div>
    }
    if (activeNav === 'shortcuts-global') {
      return renderShortcutPlaceholder('全局')
    }
    if (activeNav === 'ssh') {
      if (moduleTab === 'settings') {
        return SshComp ? <SshComp /> : <div className="text-text-3 text-sm">SSH / SFTP 面板未注册</div>
      }
      return renderShortcutPlaceholder('SSH / SFTP')
    }
    if (activeNav === 'database') {
      if (moduleTab === 'settings') {
        return DbComp ? <DbComp /> : <div className="text-text-3 text-sm">数据库面板未注册</div>
      }
      return renderShortcutPlaceholder('数据库')
    }
    if (activeNav === 'docker') {
      if (moduleTab === 'settings') {
        return (
          <div className="rounded-2xl border border-border/70 bg-bg-card/72 p-5">
            <div className="text-[14px] font-medium text-text-1 mb-1">Docker 设置</div>
            <div className="text-[12px] text-text-3 leading-relaxed">
              当前版本暂未提供 Docker 设置面板，后续会在此处接入。
            </div>
          </div>
        )
      }
      return renderShortcutPlaceholder('Docker')
    }
    return <div className="text-text-3 text-sm">未知设置页: {activeNav}</div>
  }

  if (!ready) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-base text-text-3">
        加载中...
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="settings-window-shell h-screen w-screen overflow-hidden p-0 bg-[rgba(243,246,250,0.96)] dark:bg-[rgba(16,18,23,0.96)]">
        <div className="h-full w-full rounded-[12px] border border-[rgba(0,0,0,0.04)] dark:border-[rgba(255,255,255,0.10)] ring-1 ring-[rgba(0,0,0,0.04)] dark:ring-[rgba(255,255,255,0.12)] bg-[linear-gradient(160deg,rgba(255,255,255,0.99),rgba(250,251,252,0.96))] dark:bg-[linear-gradient(160deg,rgba(34,36,42,0.96),rgba(26,28,34,0.94))] overflow-hidden flex flex-col relative">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(64,128,255,0.12),transparent_42%),radial-gradient(circle_at_88%_100%,rgba(103,194,58,0.1),transparent_36%)]" />

          <div
            onMouseDown={handleTitleBarMouseDown}
            onDoubleClick={handleTitleBarDoubleClick}
            className="relative z-10 mx-3 mt-3 h-[52px] rounded-[18px] border border-border/70 ring-1 ring-white/55 dark:ring-white/10 bg-bg-card/72 backdrop-blur-md shadow-[0_10px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.55)] flex items-center px-4 shrink-0 select-none"
          >
            <div className="w-[180px]">
              <span className="text-[14px] font-medium text-text-1">设置</span>
            </div>
            <div className="flex-1 text-center">
              <span className="inline-flex items-center gap-2 text-[12px] text-text-3">
                <span>当前分类: {activeLabel}</span>
                {saveIndicatorVisible && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] transition-opacity duration-300 ${
                      saveIndicatorFading ? 'opacity-0' : 'opacity-100'
                    } ${saveIndicatorMode === 'saving' ? 'text-primary' : 'text-status-success'}`}
                  >
                    <AppIcon icon={saveIndicatorMode === 'saving' ? icons.loader : icons.check} size={10} />
                    <span>{saveIndicatorMode === 'saving' ? '保存中...' : '已自动保存'}</span>
                  </span>
                )}
              </span>
            </div>
            <div className="w-[180px] flex justify-end">
              <WindowControls onClose={handleCloseWindow} />
            </div>
          </div>

          <div className="relative z-10 flex-1 min-h-0 flex gap-3 p-3 pt-2">
            <nav className="w-[220px] shrink-0 rounded-2xl border border-border/70 ring-1 ring-white/50 dark:ring-white/10 bg-bg-card/70 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.08)] px-2 py-2 overflow-y-auto settings-scrollbar select-none">
              {NAV_GROUPS.map((group) => (
                <div key={group.id} className="mb-2 last:mb-0">
                  <div className="px-3 py-1 text-[10px] tracking-[0.08em] uppercase font-semibold text-text-3/70">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const isActive = activeNav === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveNav(item.id)}
                        className={`relative w-full text-left text-[13px] font-medium px-3 py-2.5 rounded-xl mb-1 border transition-all duration-200 ${
                          isActive
                            ? 'text-text-1 bg-primary/12 border-primary/30 shadow-[0_8px_18px_rgba(64,128,255,0.14)]'
                            : 'text-text-3 border-transparent hover:text-text-1 hover:bg-bg-hover/70 hover:border-border/80'
                        }`}
                      >
                        {isActive && <span className="absolute left-1 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full bg-primary" />}
                        <span className="pl-2 flex items-center gap-2.5 min-w-0">
                          <AppIcon icon={item.icon} size={14} className={isActive ? 'text-primary' : 'text-text-3'} />
                          <span className="truncate">{item.label}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>

            <div className="relative flex-1 min-w-0 rounded-3xl border border-border/70 ring-1 ring-white/55 dark:ring-white/10 bg-bg-card/84 backdrop-blur-md shadow-[0_16px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5)] flex flex-col overflow-hidden">
              {isModuleNav && (
                <div className="shrink-0 px-6 pt-5 pb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {isModuleNav && (
                      <div className="inline-flex items-center rounded-xl border border-border/80 bg-bg-base/72 p-0.5">
                        <button
                          type="button"
                          onClick={() => setModuleTabs((prev) => ({ ...prev, [activeNav]: 'settings' }))}
                          className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                            moduleTab === 'settings' ? 'bg-primary text-white' : 'text-text-2 hover:bg-bg-hover'
                          }`}
                        >
                          设置
                        </button>
                        <button
                          type="button"
                          onClick={() => setModuleTabs((prev) => ({ ...prev, [activeNav]: 'shortcuts' }))}
                          className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                            moduleTab === 'shortcuts' ? 'bg-primary text-white' : 'text-text-2 hover:bg-bg-hover'
                          }`}
                        >
                          快捷键
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto settings-scrollbar p-5 pt-0 pb-8">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
