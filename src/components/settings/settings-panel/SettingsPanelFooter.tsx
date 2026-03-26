import { AppIcon, icons } from '../../icons/AppIcon'
import type { ReturnTypeSettingsPanelState } from './settings-panel-types'

export function SettingsPanelFooter({
  activeNav,
  syncTesting,
  syncTestResult,
  handleTestSync,
  resetToDefaults,
  dirty,
  applySettings,
}: Pick<
  ReturnTypeSettingsPanelState,
  'activeNav' | 'syncTesting' | 'syncTestResult' | 'handleTestSync' | 'resetToDefaults' | 'dirty' | 'applySettings'
>) {
  return (
    <div className="absolute bottom-3 left-3 right-3 z-10 flex h-[64px] items-center justify-end gap-4 rounded-2xl border border-border/70 bg-bg-card/88 px-6 shadow-[0_12px_24px_rgba(0,0,0,0.1)] backdrop-blur-xl">
      <span className="mr-2 text-[12px] text-text-3">修改会即时写入草稿，点击保存后才会应用</span>
      {activeNav === 'sync' && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={syncTesting}
            onClick={() => void handleTestSync()}
            className="flex items-center gap-1.5 rounded-xl border border-chart-green/30 bg-chart-green/12 px-5 py-2 text-[13px] font-medium text-chart-green transition-colors hover:bg-chart-green/18 disabled:opacity-50"
          >
            {syncTesting ? <AppIcon icon={icons.loader} size={14} className="animate-spin" /> : null}
            {syncTesting ? '测试中...' : '测试连接'}
          </button>
          {syncTestResult && (
            <span className={`flex items-center gap-1 text-[12px] ${syncTestResult.ok ? 'text-chart-green' : 'text-status-error'}`}>
              {syncTestResult.ok ? <AppIcon icon={icons.checkCircle} size={13} /> : <AppIcon icon={icons.alertTriangle} size={13} />}
              {syncTestResult.msg}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        className="rounded-xl border border-border/80 bg-bg-base/70 px-5 py-2 text-[13px] font-medium text-text-2 transition-colors hover:bg-bg-hover"
        onClick={resetToDefaults}
      >
        恢复默认
      </button>
      <button
        type="button"
        className={`rounded-xl border px-5 py-2 text-[13px] font-medium transition-colors ${
          dirty
            ? 'cursor-pointer border-primary/20 bg-bg-active/90 text-primary shadow-[0_8px_18px_rgba(64,128,255,0.16)] hover:opacity-90'
            : 'cursor-not-allowed border-border/70 bg-bg-base/70 text-text-disabled'
        }`}
        disabled={!dirty}
        onClick={applySettings}
      >
        保存 (Ctrl+S)
      </button>
    </div>
  )
}
