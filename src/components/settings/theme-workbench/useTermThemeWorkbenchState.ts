import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useTerminalProfileStore } from '../../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../../stores/useThemeStore'
import { useUIStore } from '../../../stores/useUIStore'
import { DEFAULT_PROFILE_ID, type TerminalProfile } from '../../../types/terminal-profile'
import type { ThemeAnalysisResult, ThemePreviewScenario, VortixTheme } from '../../../types/theme'
import { useT } from '../../../i18n'

export interface TermThemeWorkbenchState {
  t: (key: string, params?: Record<string, string | number>) => string
  profileStore: ReturnType<typeof useTerminalProfileStore.getState>
  themeStore: ReturnType<typeof useThemeStore.getState>
  openConfirmDialog: ReturnType<typeof useUIStore.getState>['openConfirmDialog']
  selectedProfileId: string
  setSelectedProfileId: Dispatch<SetStateAction<string>>
  themeBusy: boolean
  setThemeBusy: Dispatch<SetStateAction<boolean>>
  editingMode: 'light' | 'dark'
  setEditingMode: Dispatch<SetStateAction<'light' | 'dark'>>
  allProfiles: TerminalProfile[]
  profile: TerminalProfile
  appliedTheme: VortixTheme
  previewTheme: VortixTheme
  editingTheme: VortixTheme
  compareEnabled: boolean
  recentThemes: VortixTheme[]
  analysis: ThemeAnalysisResult
  canManagePreviewTheme: boolean
  isFavorite: boolean
  dirty: boolean
  activeScenario: ThemePreviewScenario
  isDefaultProfileSelected: boolean
}

export function useTermThemeWorkbenchState(isOpen: boolean): TermThemeWorkbenchState {
  const t = useT()
  const profileStore = useTerminalProfileStore()
  const themeStore = useThemeStore()
  const openConfirmDialog = useUIStore((state) => state.openConfirmDialog)

  const [selectedProfileId, setSelectedProfileId] = useState(profileStore.activeProfileId)
  const [themeBusy, setThemeBusy] = useState(false)
  const [editingMode, setEditingMode] = useState<'light' | 'dark'>(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return
    setSelectedProfileId(profileStore.activeProfileId)
  }, [isOpen, profileStore.activeProfileId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const allProfiles = profileStore.getAllProfiles()
  const profile = profileStore.getProfileById(selectedProfileId) ?? profileStore.getDefaultProfile()
  const fallbackTheme = themeStore.getThemeById(editingMode === 'dark' ? 'default-dark' : 'default-light')
    ?? themeStore.getThemesByMode(editingMode)[0]!

  const appliedThemeId = editingMode === 'dark' ? profile.colorSchemeDark : profile.colorSchemeLight
  const appliedTheme = themeStore.getThemeById(appliedThemeId) ?? fallbackTheme
  const previewCandidate = themeStore.previewThemeId ? themeStore.getThemeById(themeStore.previewThemeId) : undefined
  const previewTheme = previewCandidate?.mode === editingMode ? previewCandidate : appliedTheme
  const editingTheme = themeStore.draftTheme?.id === previewTheme.id ? themeStore.draftTheme : previewTheme
  const compareEnabled = themeStore.compareThemeId === appliedTheme.id
  const recentThemes = themeStore.recentThemeIds
    .map((themeId) => themeStore.getThemeById(themeId))
    .filter((theme): theme is VortixTheme => theme != null)
    .filter((theme) => theme.mode === editingMode && theme.id !== previewTheme.id)
    .slice(0, 4)
  const analysis = themeStore.analyzeTheme(editingTheme, appliedTheme)
  const canManagePreviewTheme = editingTheme.source === 'custom'
  const isFavorite = themeStore.favorites.includes(previewTheme.id)

  useEffect(() => {
    if (!isOpen) return
    if (themeStore.previewThemeId !== previewTheme.id) {
      themeStore.setPreviewThemeId(previewTheme.id)
    }
    if (themeStore.compareThemeId && themeStore.compareThemeId !== appliedTheme.id) {
      themeStore.setCompareThemeId(undefined)
    }
  }, [appliedTheme.id, isOpen, previewTheme.id, themeStore])

  useEffect(() => {
    if (!isOpen) return
    if (themeStore.draftTheme?.id !== previewTheme.id) {
      themeStore.startDraftFromTheme(previewTheme.id)
    }
  }, [isOpen, previewTheme.id, themeStore])

  return {
    t,
    profileStore,
    themeStore,
    openConfirmDialog,
    selectedProfileId,
    setSelectedProfileId,
    themeBusy,
    setThemeBusy,
    editingMode,
    setEditingMode,
    allProfiles,
    profile,
    appliedTheme,
    previewTheme,
    editingTheme,
    compareEnabled,
    recentThemes,
    analysis,
    canManagePreviewTheme,
    isFavorite,
    dirty: themeStore.dirty,
    activeScenario: themeStore.activeScenario,
    isDefaultProfileSelected: selectedProfileId === DEFAULT_PROFILE_ID,
  }
}
