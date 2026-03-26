import type { ITheme } from '@xterm/xterm'
import type { ThemeHighlights } from '../../../types/theme'
import { AppIcon } from '../../icons/AppIcon'
import TermThemeGrid from '../TermThemeGrid'
import TermThemePreview from '../TermThemePreview'
import { ColorInputField, ModeTab, ProfileSelector, ScoreCard, SummaryRow } from './TermThemeWorkbenchPrimitives'
import type { TermThemeWorkbenchActions } from './useTermThemeWorkbenchActions'
import type { TermThemeWorkbenchState } from './useTermThemeWorkbenchState'

const PRIMARY_TERMINAL_FIELDS: ReadonlyArray<{ field: keyof ITheme; label: string }> = [
  { field: 'background', label: 'themeWorkbench.inspector.background' },
  { field: 'foreground', label: 'themeWorkbench.inspector.foreground' },
  { field: 'cursor', label: 'themeWorkbench.inspector.cursor' },
  { field: 'selectionBackground', label: 'themeWorkbench.inspector.selection' },
]

const SECONDARY_TERMINAL_FIELDS: ReadonlyArray<{ field: keyof ITheme; label: string }> = [
  { field: 'red', label: 'themeWorkbench.inspector.ansiRed' },
  { field: 'green', label: 'themeWorkbench.inspector.ansiGreen' },
  { field: 'blue', label: 'themeWorkbench.inspector.ansiBlue' },
  { field: 'yellow', label: 'themeWorkbench.inspector.ansiYellow' },
]

const HIGHLIGHT_FIELDS: ReadonlyArray<{ field: keyof ThemeHighlights; label: string }> = [
  { field: 'error', label: 'themeWorkbench.inspector.highlightError' },
  { field: 'info', label: 'themeWorkbench.inspector.highlightInfo' },
]

function getIssueMessage(
  t: (key: string, params?: Record<string, string | number>) => string,
  code: string,
): string {
  return t(`themeWorkbench.quality.issue.${code}`)
}

export default function TermThemeWorkbenchView({
  state,
  actions,
}: {
  state: TermThemeWorkbenchState
  actions: TermThemeWorkbenchActions
}) {
  const {
    t,
    allProfiles,
    selectedProfileId,
    editingMode,
    appliedTheme,
    previewTheme,
    editingTheme,
    compareEnabled,
    profile,
    themeBusy,
    isFavorite,
    canManagePreviewTheme,
    analysis,
    recentThemes,
    dirty,
    activeScenario,
    isDefaultProfileSelected,
  } = state

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border/50 bg-bg-card/35 px-5 py-3">
        <span className="text-[12px] text-text-3">{t('themeWorkbench.profile.label')}</span>
        <ProfileSelector
          profiles={allProfiles}
          activeId={selectedProfileId}
          placeholder={t('themeWorkbench.profile.label')}
          onChange={actions.selectProfile}
        />
        <button type="button" onClick={actions.createProfile} className="island-btn h-[28px] rounded-md px-2 text-[11px] text-text-2">
          {t('themeWorkbench.profile.new')}
        </button>
        <button type="button" onClick={actions.duplicateProfile} className="island-btn h-[28px] rounded-md px-2 text-[11px] text-text-2">
          {t('themeWorkbench.profile.duplicate')}
        </button>
        {!isDefaultProfileSelected && (
          <button
            type="button"
            onClick={actions.deleteProfile}
            className="h-[28px] rounded-md border border-status-error/30 bg-status-error/5 px-2 text-[11px] text-status-error"
          >
            {t('themeWorkbench.profile.delete')}
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <div className="flex w-[320px] min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <ModeTab label={t('themeWorkbench.mode.light')} active={editingMode === 'light'} onClick={() => actions.setEditingMode('light')} />
            <ModeTab label={t('themeWorkbench.mode.dark')} active={editingMode === 'dark'} onClick={() => actions.setEditingMode('dark')} />
          </div>
          <TermThemeGrid
            mode={editingMode}
            selectedId={appliedTheme.id}
            previewId={previewTheme.id}
            onPreview={actions.previewTheme}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={actions.applyPreviewTheme}
              disabled={themeBusy || editingTheme.id === appliedTheme.id}
              className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-1 disabled:opacity-50"
            >
              {t('themeWorkbench.action.applyToProfile')}
            </button>
            <button
              type="button"
              onClick={actions.toggleCompare}
              className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2"
            >
              {compareEnabled ? t('themeWorkbench.action.hideCompare') : t('themeWorkbench.action.compareWithCurrent')}
            </button>
            <button
              type="button"
              onClick={actions.resetPreview}
              className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2"
            >
              {t('themeWorkbench.action.resetPreview')}
            </button>
            <button
              type="button"
              onClick={actions.toggleFavorite}
              className="island-btn inline-flex h-[30px] items-center gap-1.5 rounded-md px-3 text-[12px] text-text-2"
            >
              <AppIcon icon={isFavorite ? 'ph:star-fill' : 'ph:star'} size={13} />
              {isFavorite ? t('themeWorkbench.action.favorited') : t('themeWorkbench.action.favorite')}
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <TermThemePreview
              theme={editingTheme}
              compareTheme={compareEnabled ? appliedTheme : undefined}
              cursorStyle={profile.cursorStyle}
              cursorBlink={profile.cursorBlink}
              scenario={activeScenario}
              onScenarioChange={actions.setScenario}
            />
          </div>
        </div>

        <div className="flex w-[300px] min-h-0 flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">
          <div className="rounded-2xl border border-border/60 bg-bg-card/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[16px] font-semibold text-text-1">{editingTheme.name}</div>
                <div className="mt-1 text-[12px] text-text-3">
                  {editingTheme.source === 'builtin' ? t('themeWorkbench.source.builtinTheme') : t('themeWorkbench.source.customTheme')}
                </div>
              </div>
              {editingTheme.id === appliedTheme.id && (
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-primary">
                  {t('themeWorkbench.state.active')}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <SummaryRow label={t('themeWorkbench.summary.mode')} value={editingTheme.mode === 'dark' ? t('themeWorkbench.mode.dark') : t('themeWorkbench.mode.light')} />
              <SummaryRow label={t('themeWorkbench.summary.profile')} value={profile.name} />
              <SummaryRow label={t('themeWorkbench.summary.applied')} value={appliedTheme.name} />
              <SummaryRow label={t('themeWorkbench.summary.preview')} value={editingTheme.name} />
              <SummaryRow label={t('themeWorkbench.summary.editing')} value={dirty ? t('themeWorkbench.state.unsavedChanges') : t('themeWorkbench.state.inSync')} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={actions.saveDraftTheme}
                disabled={themeBusy}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {editingTheme.source === 'custom' ? t('themeWorkbench.action.saveTheme') : t('themeWorkbench.action.saveCopy')}
              </button>
              <button
                type="button"
                onClick={actions.discardDraftTheme}
                disabled={themeBusy || !dirty}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {t('themeWorkbench.action.discard')}
              </button>
              <button
                type="button"
                onClick={actions.importTheme}
                disabled={themeBusy}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {t('themeWorkbench.action.import')}
              </button>
              <button
                type="button"
                onClick={actions.repairDraftContrast}
                disabled={themeBusy}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {t('themeWorkbench.action.autoRepair')}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-bg-card/25 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-medium text-text-1">{t('themeWorkbench.inspector.title')}</div>
                <div className="mt-1 text-[11px] text-text-3">{t('themeWorkbench.inspector.desc')}</div>
              </div>
              {dirty && (
                <span className="rounded-full bg-status-warning/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-status-warning">
                  {t('themeWorkbench.state.dirty')}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {PRIMARY_TERMINAL_FIELDS.map(({ field, label }) => (
                <ColorInputField
                  key={field}
                  label={t(label)}
                  value={editingTheme.terminal[field] as string | undefined}
                  onChange={(value) => actions.updateTerminalColor(field, value)}
                />
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {SECONDARY_TERMINAL_FIELDS.map(({ field, label }) => (
                <ColorInputField
                  key={field}
                  label={t(label)}
                  value={editingTheme.terminal[field] as string | undefined}
                  onChange={(value) => actions.updateTerminalColor(field, value)}
                />
              ))}
              {HIGHLIGHT_FIELDS.map(({ field, label }) => (
                <ColorInputField
                  key={field}
                  label={t(label)}
                  value={editingTheme.highlights[field]}
                  onChange={(value) => actions.updateHighlightColor(field, value)}
                />
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={actions.exportTheme}
                disabled={themeBusy || !canManagePreviewTheme}
                className="island-btn h-[30px] rounded-md px-3 text-[12px] text-text-2 disabled:opacity-50"
              >
                {t('themeWorkbench.action.export')}
              </button>
              <button
                type="button"
                onClick={actions.deletePreviewTheme}
                disabled={themeBusy || !canManagePreviewTheme}
                className="h-[30px] rounded-md border border-status-error/30 bg-status-error/5 px-3 text-[12px] text-status-error disabled:opacity-50"
              >
                {t('themeWorkbench.action.delete')}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-bg-card/25 p-4">
            <div className="text-[13px] font-medium text-text-1">{t('themeWorkbench.quality.title')}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ScoreCard label={t('themeWorkbench.quality.score')} value={analysis.score} />
              <ScoreCard label={t('themeWorkbench.quality.contrast')} value={analysis.contrastScore} />
              <ScoreCard label={t('themeWorkbench.quality.distinct')} value={analysis.distinctivenessScore} />
              <ScoreCard label={t('themeWorkbench.quality.consistent')} value={analysis.consistencyScore} />
            </div>

            <div className="mt-4 space-y-2">
              {analysis.issues.length === 0 && (
                <div className="rounded-xl border border-border/60 bg-bg-base px-3 py-2 text-[12px] text-text-2">
                  {t('themeWorkbench.quality.noWarnings')}
                </div>
              )}
              {analysis.issues.map((issue) => (
                <div
                  key={`${issue.code}-${issue.field ?? 'global'}`}
                  className={`rounded-xl border px-3 py-2 text-[12px] ${
                    issue.level === 'error'
                      ? 'border-status-error/30 bg-status-error/5 text-status-error'
                      : issue.level === 'warning'
                        ? 'border-status-warning/30 bg-status-warning/5 text-status-warning'
                        : 'border-border/60 bg-bg-base text-text-2'
                  }`}
                >
                  {getIssueMessage(t, issue.code)}
                </div>
              ))}
            </div>

            {analysis.changedFields.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-[12px] text-text-3">{t('themeWorkbench.quality.changedFields')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.changedFields.slice(0, 8).map((field) => (
                    <span
                      key={field}
                      className="rounded-full bg-bg-base px-2 py-1 text-[10px] text-text-2"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {recentThemes.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-bg-card/25 p-4">
              <div className="text-[13px] font-medium text-text-1">{t('themeWorkbench.recent.title')}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recentThemes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => actions.selectRecentTheme(theme.id)}
                    className="rounded-full bg-bg-base px-2.5 py-1 text-[11px] text-text-2 transition-colors hover:text-text-1"
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
