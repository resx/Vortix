import { openThemeManagerWindow } from '../../../lib/window'
import { SFontSelect, SToggle } from '../SettingControls'
import { SettingGroup, SettingRow } from '../SettingGroup'
import TermThemePreview from '../TermThemePreview'
import { AppIcon, icons } from '../../icons/AppIcon'
import { CursorStylePicker, NumberInput } from './SSHSettingsPrimitives'
import type { ReturnTypeSSHState } from './ssh-settings-types'

export function SSHSettingsAppearanceSection({ state }: { state: ReturnTypeSSHState }) {
  return (
    <>
      <div className="mb-3 text-[16px] font-medium text-text-1">外观</div>
      <div className="mb-3 rounded-2xl border border-border/70 bg-bg-card/78 p-3 shadow-[0_8px_20px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-[12px] font-medium text-text-1">{state.previewPreset.name}</div>
              <span className="inline-flex shrink-0 items-center rounded-md border border-border/80 bg-bg-base px-1.5 py-0.5 text-[10px] text-text-3">
                {state.previewSourceLabel}
              </span>
              <span className="inline-flex shrink-0 items-center rounded-md border border-border/80 bg-bg-base px-1.5 py-0.5 text-[10px] text-text-3">
                {state.appearancePreviewMode === 'dark' ? 'Dark' : 'Light'}
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-text-3">预览当前终端配置下的字体、光标和主题效果。</div>
          </div>
          <button
            type="button"
            onClick={() => {
              void openThemeManagerWindow()
            }}
            className="island-btn inline-flex h-[28px] shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] text-text-2 transition-colors"
          >
            管理主题
            <AppIcon icon={icons.chevronRight} size={12} className="text-text-3" />
          </button>
        </div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[11px] text-text-3">预览模式</div>
          <div className="inline-flex shrink-0 items-center rounded-lg border border-border bg-bg-base p-0.5">
            <button
              type="button"
              onClick={() => state.setAppearancePreviewMode('light')}
              className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${state.appearancePreviewMode === 'light' ? 'bg-primary text-white' : 'text-text-2 hover:bg-border/70'}`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => state.setAppearancePreviewMode('dark')}
              className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${state.appearancePreviewMode === 'dark' ? 'bg-primary text-white' : 'text-text-2 hover:bg-border/70'}`}
            >
              Dark
            </button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/70">
          <TermThemePreview
            theme={state.previewTheme}
            cursorStyle={state.profile.cursorStyle}
            cursorBlink={state.profile.cursorBlink}
            scenario={state.themeStore.activeScenario}
            onScenarioChange={state.themeStore.setActiveScenario}
          />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 items-start gap-x-6 gap-y-4">
        <SettingGroup>
          <SFontSelect
            label="终端字体"
            value={state.profile.fontFamily}
            onChangeFonts={(fonts) => state.handleUpdateProfile('fontFamily', fonts)}
          />
          <SettingRow label="字体大小">
            <NumberInput value={state.profile.fontSize} onChange={(value) => state.handleUpdateProfile('fontSize', value)} />
          </SettingRow>
          <SettingRow label="行高">
            <NumberInput value={state.profile.lineHeight} onChange={(value) => state.handleUpdateProfile('lineHeight', value)} />
          </SettingRow>
          <SToggle k="termStripeEnabled" label="斑马背景条纹" desc="增强长输出时的横向分隔感。" />
        </SettingGroup>
        <SettingGroup>
          <SettingRow label="字距">
            <NumberInput value={state.profile.letterSpacing} onChange={(value) => state.handleUpdateProfile('letterSpacing', value)} />
          </SettingRow>
          <SettingRow label="回滚行数">
            <NumberInput value={state.profile.scrollback} onChange={(value) => state.handleUpdateProfile('scrollback', value)} width="w-[80px]" />
          </SettingRow>
          <SettingRow label="光标样式">
            <CursorStylePicker value={state.profile.cursorStyle} onChange={(value) => state.handleUpdateProfile('cursorStyle', value)} />
          </SettingRow>
          <SettingRow label="光标闪烁">
            <button
              type="button"
              onClick={() => state.handleUpdateProfile('cursorBlink', !state.profile.cursorBlink)}
              className={`relative h-[20px] w-[36px] rounded-full transition-colors ${state.profile.cursorBlink ? 'bg-primary' : 'bg-border'}`}
            >
              <div className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform ${state.profile.cursorBlink ? 'left-[18px]' : 'left-[2px]'}`} />
            </button>
          </SettingRow>
        </SettingGroup>
      </div>
    </>
  )
}
