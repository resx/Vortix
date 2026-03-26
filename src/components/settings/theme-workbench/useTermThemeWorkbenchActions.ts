import { useCallback } from 'react'
import type { ITheme } from '@xterm/xterm'
import * as api from '../../../api/client'
import { DEFAULT_PROFILE_ID } from '../../../types/terminal-profile'
import type { ThemeHighlights, ThemePreviewScenario } from '../../../types/theme'
import type { TermThemeWorkbenchState } from './useTermThemeWorkbenchState'

export interface TermThemeWorkbenchActions {
  selectProfile: (id: string) => void
  setEditingMode: (mode: 'light' | 'dark') => void
  applyPreviewTheme: () => void
  toggleCompare: () => void
  resetPreview: () => void
  toggleFavorite: () => void
  saveDraftTheme: () => Promise<void>
  discardDraftTheme: () => void
  importTheme: () => Promise<void>
  repairDraftContrast: () => void
  exportTheme: () => Promise<void>
  deletePreviewTheme: () => Promise<void>
  previewTheme: (id: string) => void
  createProfile: () => void
  duplicateProfile: () => void
  deleteProfile: () => void
  updateTerminalColor: (field: keyof ITheme, value: string) => void
  updateHighlightColor: (field: keyof ThemeHighlights, value: string) => void
  selectRecentTheme: (id: string) => void
  setScenario: (scenario: ThemePreviewScenario) => void
}

export function useTermThemeWorkbenchActions(state: TermThemeWorkbenchState): TermThemeWorkbenchActions {
  const createThemeFromPreview = useCallback(async () => {
    const name = window.prompt(
      state.t('themeWorkbench.prompt.themeName'),
      `${state.editingTheme.name} ${state.t('themeWorkbench.suffix.copy')}`,
    )?.trim()
    if (!name) return
    state.setThemeBusy(true)
    try {
      const created = await state.themeStore.createTheme({
        name,
        mode: state.editingMode,
        author: state.editingTheme.author,
        terminal: { ...state.editingTheme.terminal },
        highlights: { ...state.editingTheme.highlights },
        ui: state.editingTheme.ui ? { ...state.editingTheme.ui } : undefined,
        meta: state.editingTheme.meta ? { ...state.editingTheme.meta } : undefined,
        behavior: state.editingTheme.behavior ? { ...state.editingTheme.behavior } : undefined,
        baseThemeId: state.editingTheme.id,
      })
      state.themeStore.setPreviewThemeId(created.id)
    } catch (error) {
      window.alert(state.t('themeWorkbench.toast.createFailed', { message: (error as Error).message }))
    } finally {
      state.setThemeBusy(false)
    }
  }, [state])

  const saveDraftTheme = useCallback(async () => {
    if (!state.themeStore.draftTheme) return
    state.setThemeBusy(true)
    try {
      if (state.editingTheme.source === 'custom') {
        const updated = await state.themeStore.updateTheme(state.editingTheme.id, {
          terminal: state.editingTheme.terminal,
          highlights: state.editingTheme.highlights,
          ui: state.editingTheme.ui,
          meta: state.editingTheme.meta,
          behavior: state.editingTheme.behavior,
          baseThemeId: state.editingTheme.baseThemeId,
        })
        if (!updated) {
          window.alert(state.t('themeWorkbench.toast.saveFailed'))
          return
        }
        state.themeStore.startDraftFromTheme(updated.id)
        state.themeStore.setPreviewThemeId(updated.id)
      } else {
        await createThemeFromPreview()
      }
    } finally {
      state.setThemeBusy(false)
    }
  }, [createThemeFromPreview, state])

  const previewTheme = useCallback((id: string) => {
    if (state.themeStore.dirty && state.themeStore.draftTheme?.id === state.previewTheme.id && id !== state.previewTheme.id) {
      state.openConfirmDialog({
        title: state.t('themeWorkbench.dialog.discard.title'),
        description: state.t('themeWorkbench.dialog.discard.desc'),
        confirmText: state.t('themeWorkbench.action.discard'),
        onConfirm: async () => {
          state.themeStore.startDraftFromTheme(id)
          state.themeStore.setPreviewThemeId(id)
        },
      })
      return
    }
    state.themeStore.startDraftFromTheme(id)
    state.themeStore.setPreviewThemeId(id)
  }, [state])

  return {
    selectProfile: (id) => {
      state.setSelectedProfileId(id)
      state.profileStore.setActiveProfileId(id)
    },
    setEditingMode: (mode) => state.setEditingMode(mode),
    applyPreviewTheme: () => {
      if (state.editingTheme.id === state.appliedTheme.id) return
      if (state.editingMode === 'dark') {
        state.profileStore.updateProfile(state.selectedProfileId, { colorSchemeDark: state.editingTheme.id })
      } else {
        state.profileStore.updateProfile(state.selectedProfileId, { colorSchemeLight: state.editingTheme.id })
      }
      state.themeStore.markThemeUsed(state.editingTheme.id)
      state.themeStore.setCompareThemeId(undefined)
    },
    toggleCompare: () => {
      state.themeStore.setCompareThemeId(state.compareEnabled ? undefined : state.appliedTheme.id)
    },
    resetPreview: () => {
      state.themeStore.setPreviewThemeId(state.appliedTheme.id)
    },
    toggleFavorite: () => {
      state.themeStore.toggleFavorite(state.previewTheme.id)
    },
    saveDraftTheme,
    discardDraftTheme: () => {
      state.themeStore.startDraftFromTheme(state.previewTheme.id)
    },
    importTheme: async () => {
      state.setThemeBusy(true)
      try {
        const picked = await api.pickFile(state.t('themeWorkbench.action.import'), 'JSON Files|*.json|All Files|*.*')
        if (!picked.content?.trim()) return
        const result = await state.themeStore.importThemes(picked.content)
        if (result.count > 0) {
          window.alert(state.t('themeWorkbench.toast.imported', { count: result.count }))
        } else {
          window.alert(result.errors.join('; ') || state.t('themeWorkbench.toast.importFailed'))
        }
      } finally {
        state.setThemeBusy(false)
      }
    },
    repairDraftContrast: () => {
      state.themeStore.repairDraftContrast()
    },
    exportTheme: async () => {
      if (!state.canManagePreviewTheme) return
      state.setThemeBusy(true)
      try {
        const response = await fetch(api.getThemeExportUrl(state.editingTheme.id), {
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })
        if (!response.ok) {
          throw new Error(await response.text())
        }
        const blob = await response.blob()
        const disposition = response.headers.get('content-disposition') || ''
        const match = /filename="?([^";]+)"?/i.exec(disposition)
        const fileName = match?.[1] || `${state.editingTheme.name}.vortix-theme.json`
        const saved = await api.saveDownloadToLocal(blob, fileName)
        window.alert(state.t('themeWorkbench.toast.exported', { path: saved }))
      } catch (error) {
        window.alert(state.t('themeWorkbench.toast.exportFailed', { message: (error as Error).message }))
      } finally {
        state.setThemeBusy(false)
      }
    },
    deletePreviewTheme: async () => {
      if (!state.canManagePreviewTheme) return
      const refs = state.allProfiles.filter((item) => {
        const refId = state.editingTheme.mode === 'dark' ? item.colorSchemeDark : item.colorSchemeLight
        return refId === state.editingTheme.id
      })
      if (refs.length > 0) {
        window.alert(state.t('themeWorkbench.toast.inUse', { count: refs.length }))
        return
      }

      state.openConfirmDialog({
        title: state.t('themeWorkbench.dialog.delete.title'),
        description: state.t('themeWorkbench.dialog.delete.desc', { name: state.editingTheme.name }),
        confirmText: state.t('themeWorkbench.action.delete'),
        danger: true,
        onConfirm: async () => {
          state.setThemeBusy(true)
          try {
            const ok = await state.themeStore.deleteTheme(state.editingTheme.id)
            if (!ok) {
              window.alert(state.t('themeWorkbench.toast.deleteFailed'))
              return
            }
            state.themeStore.setPreviewThemeId(state.appliedTheme.id)
          } finally {
            state.setThemeBusy(false)
          }
        },
      })
    },
    previewTheme,
    createProfile: () => {
      const id = state.profileStore.createProfile({
        ...state.profile,
        name: state.t('themeWorkbench.profile.generated', { count: state.allProfiles.length }),
      })
      state.setSelectedProfileId(id)
      state.profileStore.setActiveProfileId(id)
    },
    duplicateProfile: () => {
      const id = state.profileStore.duplicateProfile(
        state.selectedProfileId,
        `${state.profile.name} ${state.t('themeWorkbench.suffix.copy')}`,
      )
      if (!id) return
      state.setSelectedProfileId(id)
      state.profileStore.setActiveProfileId(id)
    },
    deleteProfile: () => {
      if (state.selectedProfileId === DEFAULT_PROFILE_ID) return
      state.profileStore.deleteProfile(state.selectedProfileId)
      state.setSelectedProfileId(DEFAULT_PROFILE_ID)
      state.profileStore.setActiveProfileId(DEFAULT_PROFILE_ID)
    },
    updateTerminalColor: (field, value) => {
      state.themeStore.updateDraftTheme({ terminal: { [field]: value } as Partial<ITheme> })
    },
    updateHighlightColor: (field, value) => {
      state.themeStore.updateDraftTheme({ highlights: { [field]: value } as Partial<ThemeHighlights> })
    },
    selectRecentTheme: (id) => {
      state.themeStore.setPreviewThemeId(id)
    },
    setScenario: (scenario) => {
      state.themeStore.setActiveScenario(scenario)
    },
  }
}
