import { create } from 'zustand'
import { emit, emitTo } from '@tauri-apps/api/event'
import * as api from '../api/client'
import { useSettingsStore } from './useSettingsStore'
import { getThemeById } from '../components/terminal/themes/index'
import { enrichTheme } from '../components/terminal/themes/enrich-theme'
import { resolveFontChain } from '../lib/fonts'
import { useThemeStore } from './useThemeStore'
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
    const themeStore = useThemeStore.getState()
    const customOrBuiltin = themeStore.getThemeById(schemeId)
    const fallbackCustomOrBuiltin = themeStore.getThemeById(isDark ? 'default-dark' : 'default-light')
    const preset = getThemeById(schemeId) ?? getThemeById(isDark ? 'default-dark' : 'default-light')!
    const theme = enrichTheme(
      customOrBuiltin?.terminal ?? fallbackCustomOrBuiltin?.terminal ?? preset.theme,
    )
    const fontFamily = resolveFontChain(profile.fontFamily)
    return { profile, theme, fontFamily }
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
      // 默认配置也需要持久化并跨窗口广播，否则主题管理器改动不会同步到主窗口终端
      void (async () => {
        try {
          await s.applySettings()
          if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
            const payload = { source: 'terminal-profile' }
            await emit('config-changed', payload)
            await emitTo('main', 'config-changed', payload)
            await emitTo('settings', 'config-changed', payload)
          }
        } catch (e) {
          console.error('[Vortix] 保存默认终端配置失败', e)
        }
      })()
      // 刷新 terminal profile store 订阅者（数据来自 settings store，不落 profiles）
      set({})
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
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const payload = { source: 'terminal-profile' }
        await emit('config-changed', payload)
        await emitTo('main', 'config-changed', payload)
        await emitTo('settings', 'config-changed', payload)
      }
    } catch (e) {
      console.error('[Vortix] 保存 Profiles 失败', e)
    }
  },
}))
