import { ColorInputField, ScoreCard, SummaryRow } from '../TermThemeWorkbenchPrimitives'
import type { TermThemeWorkbenchActions } from '../useTermThemeWorkbenchActions'
import type { TermThemeWorkbenchState } from '../useTermThemeWorkbenchState'
import { getIssueMessage, HIGHLIGHT_FIELDS, PRIMARY_TERMINAL_FIELDS, SECONDARY_TERMINAL_FIELDS } from './constants'

interface WorkbenchSidebarProps {
  state: Pick<
    TermThemeWorkbenchState,
    't' | 'editingTheme' | 'appliedTheme' | 'profile' | 'dirty' | 'themeBusy' | 'canManagePreviewTheme' | 'analysis' | 'recentThemes'
  >
  actions: Pick<
    TermThemeWorkbenchActions,
    | 'saveDraftTheme'
    | 'discardDraftTheme'
    | 'importTheme'
    | 'repairDraftContrast'
    | 'updateTerminalColor'
    | 'updateHighlightColor'
    | 'exportTheme'
    | 'deletePreviewTheme'
    | 'selectRecentTheme'
  >
}

export function WorkbenchSidebar({ state, actions }: WorkbenchSidebarProps) {
  const {
    t,
    editingTheme,
    appliedTheme,
    profile,
    dirty,
    themeBusy,
    canManagePreviewTheme,
    analysis,
    recentThemes,
  } = state

  return (
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
  )
}
