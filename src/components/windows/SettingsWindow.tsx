/* 独立设置窗口（settings.html 入口） */

import { AppIcon, icons } from '../icons/AppIcon'
import { TooltipProvider } from '../ui/tooltip'
import WindowControls from '../../features/header/WindowControls'
import { useThemeEffect, useUIFontEffect } from '../../hooks/useAppEffects'
import { handleTitleBarDoubleClick, handleTitleBarMouseDown } from '../../lib/window'
import { useSettingsWindowState } from './settings-window/useSettingsWindowState'

export default function SettingsWindow() {
  const state = useSettingsWindowState()
  useThemeEffect()
  useUIFontEffect()

  if (!state.ready) {
    return <div className="h-screen w-screen flex items-center justify-center bg-bg-base text-text-3">加载中...</div>
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
            <div className="w-[180px]"><span className="text-[14px] font-medium text-text-1">设置</span></div>
            <div className="flex-1 text-center">
              <span className="inline-flex items-center gap-2 text-[12px] text-text-3">
                <span>当前分类: {state.activeLabel}</span>
                {state.saveIndicatorVisible && (
                  <span className={`inline-flex items-center gap-1 text-[10px] transition-opacity duration-300 ${state.saveIndicatorFading ? 'opacity-0' : 'opacity-100'} ${state.saveIndicatorMode === 'saving' ? 'text-primary' : 'text-status-success'}`}>
                    <AppIcon icon={state.saveIndicatorMode === 'saving' ? icons.loader : icons.check} size={10} />
                    <span>{state.saveIndicatorMode === 'saving' ? '保存中...' : '已自动保存'}</span>
                  </span>
                )}
              </span>
            </div>
            <div className="w-[180px] flex justify-end"><WindowControls onClose={state.handleCloseWindow} /></div>
          </div>

          <div className="relative z-10 flex-1 min-h-0 flex gap-3 p-3 pt-2">
            <nav className="w-[220px] shrink-0 rounded-2xl border border-border/70 ring-1 ring-white/50 dark:ring-white/10 bg-bg-card/70 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.08)] px-2 py-2 overflow-y-auto settings-scrollbar select-none">
              {state.NAV_GROUPS.map((group) => (
                <div key={group.id} className="mb-2 last:mb-0">
                  <div className="px-3 py-1 text-[10px] tracking-[0.08em] uppercase font-semibold text-text-3/70">{group.label}</div>
                  {group.items.map((item) => {
                    const isActive = state.activeNav === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => state.setActiveNav(item.id)}
                        className={`relative w-full text-left text-[13px] font-medium px-3 py-2.5 rounded-xl mb-1 border transition-all duration-200 ${isActive ? 'text-text-1 bg-primary/12 border-primary/30 shadow-[0_8px_18px_rgba(64,128,255,0.14)]' : 'text-text-3 border-transparent hover:text-text-1 hover:bg-bg-hover/70 hover:border-border/80'}`}
                      >
                        {isActive && <span className="absolute left-1 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full bg-primary" />}
                        <span className="pl-2 flex items-center gap-2.5 min-w-0"><AppIcon icon={item.icon} size={14} className={isActive ? 'text-primary' : 'text-text-3'} /><span className="truncate">{item.label}</span></span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>

            <div className="relative flex-1 min-w-0 rounded-3xl border border-border/70 ring-1 ring-white/55 dark:ring-white/10 bg-bg-card/84 backdrop-blur-md shadow-[0_16px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.5)] flex flex-col overflow-hidden">
              {state.isModuleNav && (
                <div className="shrink-0 px-6 pt-5 pb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="inline-flex items-center rounded-xl border border-border/80 bg-bg-base/72 p-0.5">
                      <button type="button" onClick={() => state.setModuleTabs((prev) => ({ ...prev, [state.activeNav]: 'settings' }))} className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${state.moduleTab === 'settings' ? 'bg-primary text-white' : 'text-text-2 hover:bg-bg-hover'}`}>设置</button>
                      <button type="button" onClick={() => state.setModuleTabs((prev) => ({ ...prev, [state.activeNav]: 'shortcuts' }))} className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${state.moduleTab === 'shortcuts' ? 'bg-primary text-white' : 'text-text-2 hover:bg-bg-hover'}`}>快捷键</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto settings-scrollbar p-5 pt-0 pb-8">{state.renderContent()}</div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
