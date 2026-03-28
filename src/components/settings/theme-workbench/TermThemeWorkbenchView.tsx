import { AppIcon } from '../../icons/AppIcon'
import TermThemeGrid from '../TermThemeGrid'
import TermThemePreview from '../TermThemePreview'
import { ModeTab } from './TermThemeWorkbenchPrimitives'
import { WorkbenchHeader } from './theme-workbench-view/WorkbenchHeader'
import { WorkbenchSidebar } from './theme-workbench-view/WorkbenchSidebar'
import type { TermThemeWorkbenchActions } from './useTermThemeWorkbenchActions'
import type { TermThemeWorkbenchState } from './useTermThemeWorkbenchState'

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
      <WorkbenchHeader
        state={{ t, allProfiles, selectedProfileId, isDefaultProfileSelected }}
        actions={{
          selectProfile: actions.selectProfile,
          createProfile: actions.createProfile,
          duplicateProfile: actions.duplicateProfile,
          deleteProfile: actions.deleteProfile,
        }}
      />

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

        <WorkbenchSidebar
          state={{
            t,
            editingTheme,
            appliedTheme,
            profile,
            dirty,
            themeBusy,
            canManagePreviewTheme,
            analysis,
            recentThemes,
          }}
          actions={{
            saveDraftTheme: actions.saveDraftTheme,
            discardDraftTheme: actions.discardDraftTheme,
            importTheme: actions.importTheme,
            repairDraftContrast: actions.repairDraftContrast,
            updateTerminalColor: actions.updateTerminalColor,
            updateHighlightColor: actions.updateHighlightColor,
            exportTheme: actions.exportTheme,
            deletePreviewTheme: actions.deletePreviewTheme,
            selectRecentTheme: actions.selectRecentTheme,
          }}
        />
      </div>
    </>
  )
}
