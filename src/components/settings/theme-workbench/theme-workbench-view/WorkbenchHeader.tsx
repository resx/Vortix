import { ProfileSelector } from '../TermThemeWorkbenchPrimitives'
import type { TermThemeWorkbenchActions } from '../useTermThemeWorkbenchActions'
import type { TermThemeWorkbenchState } from '../useTermThemeWorkbenchState'

interface WorkbenchHeaderProps {
  state: Pick<TermThemeWorkbenchState, 't' | 'allProfiles' | 'selectedProfileId' | 'isDefaultProfileSelected'>
  actions: Pick<TermThemeWorkbenchActions, 'selectProfile' | 'createProfile' | 'duplicateProfile' | 'deleteProfile'>
}

export function WorkbenchHeader({ state, actions }: WorkbenchHeaderProps) {
  const { t, allProfiles, selectedProfileId, isDefaultProfileSelected } = state

  return (
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
  )
}
