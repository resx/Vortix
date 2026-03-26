/* ── 独立终端窗口视图 ── */
/* 通过 ?detach=terminal&id=<connectionId>&tab=<tabId> 参数加载 */

import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useTabStore } from '../../stores/useTabStore'
import { TooltipProvider } from '../ui/tooltip'
import WindowControls from '../../features/header/WindowControls'
import WorkspaceLayout from '../workspace/WorkspaceLayout'
import { useThemeEffect, useUIFontEffect, useConfigChangedListener, useWindowSizeEffect } from '../../hooks/useAppEffects'
import { handleTitleBarMouseDown, handleTitleBarDoubleClick } from '../../lib/window'
import { loadLocale } from '../../i18n'
import * as api from '../../api/client'
import type { AssetRow } from '../../types'

interface DetachedTerminalProps {
  connectionId: string
  tabId?: string
}

export default function DetachedTerminalView({ connectionId }: DetachedTerminalProps) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)

  useThemeEffect()
  useUIFontEffect()
  useConfigChangedListener()
  useWindowSizeEffect()

  // 数据就绪后再显示窗口，消除白屏闪烁
  useEffect(() => {
    if (!ready) return
    if (!('__TAURI_INTERNALS__' in window)) return
    requestAnimationFrame(() => {
      const win = getCurrentWindow()
      win.show().then(() => win.setFocus())
    })
  }, [ready])

  useEffect(() => {
    Promise.all([
      useSettingsStore.getState().loadSettings(),
      useThemeStore.getState().loadCustomThemes().catch(() => {}),
      api.getConnection(connectionId),
    ]).then(([, , conn]) => {
      useTerminalProfileStore.getState().loadProfiles()
      const lang = useSettingsStore.getState().language
      loadLocale(lang)

      const assetRow: AssetRow = {
        id: conn.id,
        name: conn.name,
        type: 'asset',
        protocol: conn.protocol,
        colorTag: conn.color_tag,
        latency: '-',
        host: conn.host,
        user: conn.username,
        created: '',
        expire: '',
        remark: conn.remark ?? '',
        folderId: conn.folder_id,
      }
      useTabStore.getState().openAssetTab(assetRow)
      setReady(true)
    }).catch((e) => {
      setError((e as Error).message || '连接加载失败')
    })
  }, [connectionId])

  const activeTab = tabs.find((t) => t.id === activeTabId && t.type === 'asset')

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-base text-status-error text-sm">
        {error}
      </div>
    )
  }

  if (!ready || !activeTab) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-base text-text-3">
        连接中…
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div id="app-root" className="h-screen w-screen flex flex-col bg-bg-base text-text-0 overflow-hidden">
        <div
          onMouseDown={handleTitleBarMouseDown}
          onDoubleClick={handleTitleBarDoubleClick}
          className="h-[36px] flex items-center justify-between px-3 shrink-0 select-none border-b border-border"
        >
          <span className="text-[13px] text-text-2 truncate">
            {activeTab.label} — {activeTab.assetRow?.host ?? ''}
          </span>
          <WindowControls />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <WorkspaceLayout tab={activeTab} />
        </div>
      </div>
    </TooltipProvider>
  )
}
