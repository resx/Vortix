import { useState } from 'react'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../../stores/useThemeStore'
import type { TermThemePreset } from '../../terminal/themes'
import { getThemeById } from '../../terminal/themes'
import { DEFAULT_HIGHLIGHTS } from '../../../lib/theme-bridge'

export function useSSHSettingsState() {
  const [appearancePreviewMode, setAppearancePreviewMode] = useState<'light' | 'dark'>(
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
  )

  const profileStore = useTerminalProfileStore()
  const themeStore = useThemeStore()
  const update = useSettingsStore((state) => state.updateSetting)
  const termLogDir = useSettingsStore((state) => state.termLogDir)
  const sftpDefaultSavePath = useSettingsStore((state) => state.sftpDefaultSavePath)
  const profile = profileStore.getProfileById(profileStore.activeProfileId) ?? profileStore.getDefaultProfile()

  const toPreset = (id: string, fallback: 'default-light' | 'default-dark'): TermThemePreset => {
    const dynamic = themeStore.getThemeById(id)
    if (dynamic) {
      return {
        id: dynamic.id,
        name: dynamic.name,
        mode: dynamic.mode,
        theme: dynamic.terminal,
      }
    }
    return getThemeById(fallback)!
  }

  const lightPreset = toPreset(profile.colorSchemeLight, 'default-light')
  const darkPreset = toPreset(profile.colorSchemeDark, 'default-dark')
  const previewPreset = appearancePreviewMode === 'dark' ? darkPreset : lightPreset
  const lightSource = themeStore.getThemeById(profile.colorSchemeLight)?.source ?? 'builtin'
  const darkSource = themeStore.getThemeById(profile.colorSchemeDark)?.source ?? 'builtin'
  const previewSource = appearancePreviewMode === 'dark' ? darkSource : lightSource
  const previewSourceLabel = previewSource === 'builtin' ? '内置主题' : '自定义主题'
  const previewTheme = themeStore.getThemeById(
    appearancePreviewMode === 'dark' ? profile.colorSchemeDark : profile.colorSchemeLight,
  ) ?? {
    id: previewPreset.id,
    name: previewPreset.name,
    mode: previewPreset.mode,
    version: 1 as const,
    source: previewSource,
    terminal: previewPreset.theme,
    highlights: { ...DEFAULT_HIGHLIGHTS },
  }

  const handleUpdateProfile = <K extends string>(key: K, value: unknown) => {
    profileStore.updateProfile(profileStore.activeProfileId, { [key]: value } as never)
  }

  return {
    appearancePreviewMode,
    setAppearancePreviewMode,
    profileStore,
    themeStore,
    profile,
    previewPreset,
    previewSourceLabel,
    previewTheme,
    termLogDir,
    sftpDefaultSavePath,
    update,
    handleUpdateProfile,
  }
}
