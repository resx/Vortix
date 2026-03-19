/* ── Header 精简壳 ── */

import { useState, useEffect, useRef } from 'react'
import { emit, emitTo } from '@tauri-apps/api/event'
import { AppIcon, icons } from '../icons/AppIcon'
import { useTabStore } from '../../stores/useTabStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useUIStore } from '../../stores/useUIStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import VortixLogoGroup from '../../features/header/VortixLogo'
import HeaderToolbar from '../../features/header/HeaderToolbar'
import MainMenu from '../../features/header/MainMenu'
import WindowControls from '../../features/header/WindowControls'
import SyncQuickPopover from '../../features/header/popovers/SyncQuickPopover'
import KeyPickerModal from '../settings/KeyPickerModal'
import { handleTitleBarMouseDown, handleTitleBarDoubleClick } from '../../lib/window'

export default function Header() {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const tabs = useTabStore((s) => s.tabs)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const themeMode = useSettingsStore((s) => s.theme)
  const lockPassword = useSettingsStore((s) => s.lockPassword)
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const applySettings = useSettingsStore((s) => s.applySettings)
  const loaded = useSettingsStore((s) => s._loaded)
  const setLocked = useUIStore((s) => s.setLocked)

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isAssetTab = activeTab?.type === 'asset'
  const isConnected = activeTab?.status === 'connected'

  // 主题切换
  const themeIcon = themeMode === 'light' ? icons.sun : themeMode === 'dark' ? icons.moon : icons.monitor
  const themeLabel = themeMode === 'light' ? '亮色模式' : themeMode === 'dark' ? '暗黑模式' : '跟随系统'
  const cycleTheme = async () => {
    const next = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light'
    updateSetting('theme', next)
    if (!loaded) return
    await applySettings()
    const payload = { source: 'header-theme', keys: ['theme'] as string[] }
    if ('__TAURI_INTERNALS__' in window) {
      await emit('config-changed', payload)
      await emitTo('settings', 'config-changed', payload)
    }
  }

  // 同步弹出层
  const [showSyncPopover, setShowSyncPopover] = useState(false)
  const [showKeyPicker, setShowKeyPicker] = useState(false)
  const syncBtnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (syncBtnRef.current && !syncBtnRef.current.contains(e.target as Node)) setShowSyncPopover(false)
    }
    if (showSyncPopover) window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [showSyncPopover])

  return (
    <header id="header" onMouseDown={handleTitleBarMouseDown} onDoubleClick={handleTitleBarDoubleClick} className="h-[48px] bg-bg-base flex items-center justify-between px-3 shrink-0 select-none z-10">
      {/* Logo 区域 */}
      <div id="header-logo" className="w-[330px] flex items-center gap-2 shrink-0">
        <button className="flex items-center" onClick={() => setActiveTab('list')}>
          <VortixLogoGroup />
        </button>

        {isAssetTab && activeTab?.assetRow && (
          <div id="header-breadcrumb" className="flex items-center gap-1 text-[13px] text-text-3 ml-2">
            <AppIcon icon={icons.chevronRight} size={14} className="w-3.5 h-3.5" />
            {activeTab.assetRow.folderName && (
              <>
                <span className="hover:text-text-1 cursor-pointer transition-colors">{activeTab.assetRow.folderName}</span>
                <AppIcon icon={icons.chevronRight} size={14} className="w-3.5 h-3.5" />
              </>
            )}
            <span className="text-text-1 font-medium">{activeTab.assetRow.name}</span>
          </div>
        )}
      </div>

      {/* 右侧操作区 */}
      <div id="header-actions" className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-text-2">
          {/* 动态连接工具 — 仅在资产已连接时显示 */}
          {isAssetTab && isConnected && (
            <HeaderToolbar activeTabId={activeTabId} connectionId={activeTab?.connectionId} assetLabel={activeTab?.label ?? ''} />
          )}

          {/* 锁屏手动控制 */}
          {lockPassword && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => setLocked(true)} className="hover:text-text-1 transition-colors mr-1">
                  <AppIcon icon={icons.lock} size={15} />
                </button>
              </TooltipTrigger>
              <TooltipContent>立即锁屏</TooltipContent>
            </Tooltip>
          )}

          {/* 主题切换 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={cycleTheme} className="hover:text-text-1 transition-colors">
                <AppIcon icon={themeIcon} size={15} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{themeLabel}</TooltipContent>
          </Tooltip>

          {/* 密钥管理 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setShowKeyPicker(true)} className="hover:text-text-1 transition-colors">
                <AppIcon icon={icons.keyRound} size={15} />
              </button>
            </TooltipTrigger>
            <TooltipContent>密钥管理</TooltipContent>
          </Tooltip>

          {/* 云同步快捷入口 */}
          <div className="relative" ref={syncBtnRef}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSyncPopover(prev => !prev) }}
                  className={`transition-colors ${showSyncPopover ? 'text-primary' : 'hover:text-text-1'}`}
                >
                  <AppIcon icon={icons.cloud} size={15} />
                </button>
              </TooltipTrigger>
              {!showSyncPopover && <TooltipContent>数据同步</TooltipContent>}
            </Tooltip>
            {showSyncPopover && <SyncQuickPopover onClose={() => setShowSyncPopover(false)} />}
          </div>

          {/* 主菜单 */}
          <MainMenu />
        </div>

        {/* 窗口控制 */}
        <WindowControls />
      </div>

      {/* 私钥选择弹窗 */}
      {showKeyPicker && (
        <KeyPickerModal
          onSelect={(key) => { navigator.clipboard.writeText(key) }}
          onClose={() => setShowKeyPicker(false)}
        />
      )}
    </header>
  )
}
