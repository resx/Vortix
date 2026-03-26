import { cn } from '../../lib/utils'
import type { ThemePreviewScenario, VortixTheme } from '../../types/theme'
import { useT } from '../../i18n'
import { PreviewTerminalStage } from './theme-preview/PreviewTerminalStage'
import { SCENARIOS } from './theme-preview/preview-scenarios'

export default function TermThemePreview({
  theme,
  compareTheme,
  cursorStyle,
  cursorBlink,
  scenario,
  onScenarioChange,
}: {
  theme: VortixTheme
  compareTheme?: VortixTheme
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scenario: ThemePreviewScenario
  onScenarioChange: (scenario: ThemePreviewScenario) => void
}) {
  const t = useT()
  const activeScenario = SCENARIOS.find((item) => item === scenario) ?? SCENARIOS[0]

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border/60 bg-bg-card/25 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium text-text-1">{t('themeWorkbench.preview.title')}</div>
          <div className="mt-1 text-[12px] text-text-3">{t(`themeWorkbench.preview.scenario.${activeScenario}.description`)}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {SCENARIOS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onScenarioChange(item)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] transition-colors',
                item === scenario
                  ? 'bg-primary text-white'
                  : 'bg-bg-base text-text-2 hover:text-text-1',
              )}
            >
              {t(`themeWorkbench.preview.scenario.${item}.label`)}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('mt-4 grid min-h-0 flex-1 gap-4', compareTheme ? 'grid-cols-2' : 'grid-cols-1')}>
        <PreviewTerminalStage
          theme={theme}
          label={compareTheme ? t('themeWorkbench.preview.candidate') : t('themeWorkbench.preview.preview')}
          cursorStyle={cursorStyle}
          cursorBlink={cursorBlink}
          scenario={scenario}
          dimmed={scenario === 'unfocused'}
          t={t}
        />
        {compareTheme && (
          <PreviewTerminalStage
            theme={compareTheme}
            label={t('themeWorkbench.preview.current')}
            cursorStyle={cursorStyle}
            cursorBlink={cursorBlink}
            scenario={scenario}
            dimmed={scenario === 'unfocused'}
            t={t}
          />
        )}
      </div>
    </div>
  )
}
