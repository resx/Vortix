import { useCallback, useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { emit, emitTo, listen } from '@tauri-apps/api/event'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../../stores/useThemeStore'
import { getSettingsComponent } from '../../../registries/settings-panel.registry'
import { loadLocale } from '../../../i18n'
import { shouldBlockTabFocusNavigation } from '../../../lib/focus-tab-policy'
import { NAV_GROUPS, normalizeIncomingNav, renderShortcutPlaceholder, type ModuleTab, type NavId } from './config'

export function useSettingsWindowState() {
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

  const clearSaveIndicatorTimers = useCallback(() => {
    if (saveFadeTimerRef.current !== null) { window.clearTimeout(saveFadeTimerRef.current); saveFadeTimerRef.current = null }
    if (saveHideTimerRef.current !== null) { window.clearTimeout(saveHideTimerRef.current); saveHideTimerRef.current = null }
  }, [])

  const handleApply = useCallback(async () => {
    await applySettings()
    const payload = { source: 'settings' }
    await emit('config-changed', payload)
    if ('__TAURI_INTERNALS__' in window) await emitTo('main', 'config-changed', payload)
  }, [applySettings])

  const handleCloseWindow = useCallback(async () => {
    if (!('__TAURI_INTERNALS__' in window)) { window.close(); return }
    const win = getCurrentWindow()
    try { await win.close(); await new Promise((resolve) => window.setTimeout(resolve, 80)); const stillVisible = await win.isVisible().catch(() => false); if (!stillVisible) return } catch {}
    try { await win.hide(); return } catch {}
    const maybeDestroy = win as unknown as { destroy?: () => Promise<void> }
    if (typeof maybeDestroy.destroy === 'function') await maybeDestroy.destroy().catch(() => {})
  }, [])

  useEffect(() => {
    loadSettings()
      .then(() => {
        const lang = useSettingsStore.getState().language
        return Promise.all([useTerminalProfileStore.getState().loadProfiles().catch(() => {}), useThemeStore.getState().loadCustomThemes().catch(() => {}), loadLocale(lang).catch(() => {})])
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [loadSettings])

  useEffect(() => {
    const unlisten = listen<string>('navigate-settings', (event) => {
      const parsed = normalizeIncomingNav(event.payload)
      setActiveNav(parsed.id)
      if (parsed.tab && (parsed.id === 'ssh' || parsed.id === 'database' || parsed.id === 'docker')) setModuleTabs((prev) => ({ ...prev, [parsed.id]: parsed.tab }))
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [])

  useEffect(() => {
    const unlisten = listen<{ source?: string }>('config-changed', (event) => {
      if (event.payload?.source === 'settings') return
      void loadSettings().then(() => {
        const lang = useSettingsStore.getState().language
        return Promise.all([useTerminalProfileStore.getState().loadProfiles().catch(() => {}), useThemeStore.getState().loadCustomThemes().catch(() => {}), loadLocale(lang).catch(() => {})])
      })
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [loadSettings])

  useEffect(() => {
    if (!ready || !('__TAURI_INTERNALS__' in window)) return
    requestAnimationFrame(() => { const win = getCurrentWindow(); win.show().then(() => win.setFocus()) })
  }, [ready])

  useEffect(() => {
    if (!ready || !dirty) return
    const timer = window.setTimeout(async () => {
      clearSaveIndicatorTimers()
      setSaveIndicatorVisible(true)
      setSaveIndicatorFading(false)
      setSaveIndicatorMode('saving')
      await handleApply()
      setSaveIndicatorMode('saved')
      saveFadeTimerRef.current = window.setTimeout(() => setSaveIndicatorFading(true), 2200)
      saveHideTimerRef.current = window.setTimeout(() => { setSaveIndicatorVisible(false); setSaveIndicatorFading(false); setSaveIndicatorMode('idle') }, 2500)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [clearSaveIndicatorTimers, dirty, handleApply, ready])

  useEffect(() => () => clearSaveIndicatorTimers(), [clearSaveIndicatorTimers])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (shouldBlockTabFocusNavigation(e)) { e.preventDefault(); e.stopPropagation(); return }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (dirty) void handleApply() }
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
    if (activeNav === 'basic') return BasicComp ? <BasicComp /> : <div className="text-text-3 text-sm">基础设置面板未注册</div>
    if (activeNav === 'sync') return SyncComp ? <SyncComp /> : <div className="text-text-3 text-sm">数据同步面板未注册</div>
    if (activeNav === 'shortcuts-global') return renderShortcutPlaceholder('全局')
    if (activeNav === 'ssh') return moduleTab === 'settings' ? (SshComp ? <SshComp /> : <div className="text-text-3 text-sm">SSH / SFTP 面板未注册</div>) : renderShortcutPlaceholder('SSH / SFTP')
    if (activeNav === 'database') return moduleTab === 'settings' ? (DbComp ? <DbComp /> : <div className="text-text-3 text-sm">数据库面板未注册</div>) : renderShortcutPlaceholder('数据库')
    if (activeNav === 'docker') return moduleTab === 'settings'
      ? (<div className="rounded-2xl border border-border/70 bg-bg-card/72 p-5"><div className="text-[14px] font-medium text-text-1 mb-1">Docker 设置</div><div className="text-[12px] text-text-3 leading-relaxed">当前版本暂未提供 Docker 设置面板，后续会在此处接入。</div></div>)
      : renderShortcutPlaceholder('Docker')
    return <div className="text-text-3 text-sm">未知设置页: {activeNav}</div>
  }

  return {
    NAV_GROUPS,
    activeNav,
    setActiveNav,
    moduleTabs,
    setModuleTabs,
    ready,
    dirty,
    activeLabel,
    isModuleNav,
    moduleTab,
    saveIndicatorMode,
    saveIndicatorVisible,
    saveIndicatorFading,
    renderContent,
    handleCloseWindow,
  }
}
