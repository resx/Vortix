import { create } from 'zustand'
import * as api from '../api/client'
import { useSettingsStore } from './useSettingsStore'
import { getThemeById } from '../components/terminal/themes/index'
import { resolveFontChain } from '../lib/fonts'
import { DEFAULT_PROFILE_ID } from '../types/terminal-profile'
import type { TerminalProfile, ResolvedProfile } from '../types/terminal-profile'

interface TerminalProfileStore {
  profiles: TerminalProfile[]
  activeProfileId: string
  _loaded: boolean

  getDefaultProfile: () => TerminalProfile
  getAllProfiles: () => TerminalProfile[]
  getProfileById: (id: string) => TerminalProfile | undefined
  resolveProfile: (id: string, isDark: boolean) => ResolvedProfile
  createProfile: (data: Omit<TerminalProfile, 'id' | 'isDefault'>) => string
  updateProfile: (id: string, data: Partial<Omit<TerminalProfile, 'id' | 'isDefault'>>) => void
  deleteProfile: (id: string) => void
  duplicateProfile: (id: string, name: string) => string | null
  setActiveProfileId: (id: string) => void
  loadProfiles: () => Promise<void>
  saveProfiles: () => Promise<void>
}

let _nextId = 1

function generateId(): string {
  return `profile_${Date.now()}_${_nextId++}`
}

export const useTerminalProfileStore = create<TerminalProfileStore>((set, get) => ({
  profiles: [],
  activeProfileId: DEFAULT_PROFILE_ID,
  _loaded: false,

  getDefaultProfile: () => {
    const s = useSettingsStore.getState()
    return {
      id: DEFAULT_PROFILE_ID,
      name: '默认',
      isDefault: true,
      colorSchemeLight: s.termThemeLight,
      colorSchemeDark: s.termThemeDark,
      fontFamily: s.termFontFamily,
      fontSize: s.termFontSize,
      lineHeight: s.termLineHeight,
      letterSpacing: s.termLetterSpacing,
      cursorStyle: s.termCursorStyle,
      cursorBlink: s.termCursorBlink,
      scrollback: s.termScrollback,
      keywordHighlights: s.keywordHighlights,
    }
  },

  getAllProfiles: () => {
    const { profiles, getDefaultProfile } = get()
    return [getDefaultProfile(), ...profiles]
  },

  getProfileById: (id) => {
    if (id === DEFAULT_PROFILE_ID) return get().getDefaultProfile()
    return get().profiles.find(p => p.id === id)
  },

  resolveProfile: (id, isDark) => {
    const profile = get().getProfileById(id) ?? get().getDefaultProfile()
    const schemeId = isDark ? profile.colorSchemeDark : profile.colorSchemeLight
    const preset = getThemeById(schemeId) ?? getThemeById(isDark ? 'default-dark' : 'default-light')!
    const fontFamily = resolveFontChain(profile.fontFamily)
    return { profile, theme: preset.theme, fontFamily }
  },

  createProfile: (data) => {
    const id = generateId()
    const profile: TerminalProfile = { ...data, id, isDefault: false }
    set(s => ({ profiles: [...s.profiles, profile] }))
    get().saveProfiles()
    return id
  },

  updateProfile: (id, data) => {
    if (id === DEFAULT_PROFILE_ID) {
      // 回写到全局设置
      const s = useSettingsStore.getState()
      if (data.colorSchemeLight !== undefined) s.updateSetting('termThemeLight', data.colorSchemeLight)
      if (data.colorSchemeDark !== undefined) s.updateSetting('termThemeDark', data.colorSchemeDark)
      if (data.fontFamily !== undefined) s.updateSetting('termFontFamily', data.fontFamily)
      if (data.fontSize !== undefined) s.updateSetting('termFontSize', data.fontSize)
      if (data.lineHeight !== undefined) s.updateSetting('termLineHeight', data.lineHeight)
      if (data.letterSpacing !== undefined) s.updateSetting('termLetterSpacing', data.letterSpacing)
      if (data.cursorStyle !== undefined) s.updateSetting('termCursorStyle', data.cursorStyle)
      if (data.cursorBlink !== undefined) s.updateSetting('termCursorBlink', data.cursorBlink)
      if (data.scrollback !== undefined) s.updateSetting('termScrollback', data.scrollback)
      if (data.keywordHighlights !== undefined) s.updateSetting('keywordHighlights', data.keywordHighlights)
      return
    }
    set(s => ({
      profiles: s.profiles.map(p => p.id === id ? { ...p, ...data } : p),
    }))
    get().saveProfiles()
  },

  deleteProfile: (id) => {
    if (id === DEFAULT_PROFILE_ID) return
    set(s => {
      const next: Partial<TerminalProfileStore> = {
        profiles: s.profiles.filter(p => p.id !== id),
      }
      if (s.activeProfileId === id) next.activeProfileId = DEFAULT_PROFILE_ID
      return next
    })
    get().saveProfiles()
  },

  duplicateProfile: (id, name) => {
    const source = get().getProfileById(id)
    if (!source) return null
    const newId = generateId()
    const profile: TerminalProfile = { ...source, id: newId, name, isDefault: false }
    set(s => ({ profiles: [...s.profiles, profile] }))
    get().saveProfiles()
    return newId
  },

  setActiveProfileId: (id) => {
    set({ activeProfileId: id })
    get().saveProfiles()
  },

  loadProfiles: async () => {
    try {
      const remote = await api.getSettings() as Record<string, unknown>
      const profiles = Array.isArray(remote.terminalProfiles) ? remote.terminalProfiles as TerminalProfile[] : []
      const activeId = typeof remote.activeProfileId === 'string' ? remote.activeProfileId : DEFAULT_PROFILE_ID
      set({ profiles, activeProfileId: activeId, _loaded: true })
    } catch {
      set({ _loaded: true })
    }
  },

  saveProfiles: async () => {
    try {
      const { profiles, activeProfileId } = get()
      const current = await api.getSettings() as Record<string, unknown>
      await api.saveSettings({ ...current, terminalProfiles: profiles, activeProfileId } as never)
    } catch (e) {
      console.error('[Vortix] 保存 Profiles 失败', e)
    }
  },
}))
