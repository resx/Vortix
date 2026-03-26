import { useEffect, useRef, useState } from 'react'
import { useDragControls } from 'framer-motion'
import * as api from '../../../api/client'
import { useUIStore } from '../../../stores/useUIStore'
import { buildSyncBody, useSettingsStore } from '../../../stores/useSettingsStore'
import { getSettingsComponent, getSettingsEntries } from '../../../registries/settings-panel.registry'

export function useSettingsPanelState() {
  const toggleSettings = useUIStore((state) => state.toggleSettings)
  const settingsInitialNav = useUIStore((state) => state.settingsInitialNav)
  const setSettingsInitialNav = useUIStore((state) => state.setSettingsInitialNav)
  const dirty = useSettingsStore((state) => state._dirty)
  const applySettings = useSettingsStore((state) => state.applySettings)
  const resetToDefaults = useSettingsStore((state) => state.resetToDefaults)

  const [activeNav, setActiveNav] = useState(settingsInitialNav || 'basic')
  const [pinned, setPinned] = useState(false)
  const [syncTesting, setSyncTesting] = useState(false)
  const [syncTestResult, setSyncTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [maximized, setMaximized] = useState(false)
  const dragControls = useDragControls()
  const constraintRef = useRef<HTMLDivElement>(null)

  const handleTestSync = async () => {
    setSyncTesting(true)
    setSyncTestResult(null)
    try {
      await api.syncTest(buildSyncBody())
      setSyncTestResult({ ok: true, msg: '连接正常' })
    } catch (error) {
      setSyncTestResult({ ok: false, msg: (error as Error).message })
    } finally {
      setSyncTesting(false)
    }
    window.setTimeout(() => setSyncTestResult(null), 4000)
  }

  useEffect(() => {
    if (settingsInitialNav) {
      setActiveNav(settingsInitialNav)
      setSettingsInitialNav(null)
    }
  }, [setSettingsInitialNav, settingsInitialNav])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggleSettings()
      if (event.key === 's' && (event.ctrlKey || event.metaKey) && dirty) {
        event.preventDefault()
        applySettings()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [applySettings, dirty, toggleSettings])

  return {
    toggleSettings,
    dirty,
    applySettings,
    resetToDefaults,
    activeNav,
    setActiveNav,
    pinned,
    setPinned,
    syncTesting,
    syncTestResult,
    handleTestSync,
    maximized,
    setMaximized,
    dragControls,
    constraintRef,
    navData: getSettingsEntries(),
    ContentComponent: getSettingsComponent(activeNav),
    panelSize: maximized
      ? 'w-full h-full max-w-full max-h-full rounded-none'
      : 'w-[1100px] max-w-[95vw] h-[720px] max-h-[95vh] rounded-[30px]',
  }
}
