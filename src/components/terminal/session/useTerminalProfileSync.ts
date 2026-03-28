import { useEffect } from 'react'
import { useSettingsStore } from '../../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../../stores/useThemeStore'
import { getSession } from '../../../stores/terminalSessionRegistry'
import type { TerminalSession } from '../../../stores/terminalSessionRegistry'

interface UseTerminalProfileSyncOptions {
  paneId: string
  profileId?: string | null
  applyPerformanceMode: (session: TerminalSession, enabled: boolean) => void
  stabilizeTerminalLayout: (session: TerminalSession, preferredFont?: string) => void
  safeFit: (session: TerminalSession) => void
  updateCellHeight: () => void
}

export function useTerminalProfileSync({
  paneId,
  profileId,
  applyPerformanceMode,
  stabilizeTerminalLayout,
  safeFit,
  updateCellHeight,
}: UseTerminalProfileSyncOptions) {
  useEffect(() => {
    const applyProfile = () => {
      const session = getSession(paneId)
      if (!session) return
      const settings = useSettingsStore.getState()
      const isDark = useThemeStore.getState().runtimeMode === 'dark'
      const resolved = useTerminalProfileStore.getState()
        .resolveProfile(profileId ?? settings.activeProfileId, isDark)

      session.term.options.theme = resolved.theme
      session.term.options.fontFamily = resolved.fontFamily
      session.term.options.fontSize = resolved.profile.fontSize
      session.term.options.lineHeight = resolved.profile.lineHeight || 1.6
      session.term.options.letterSpacing = resolved.profile.letterSpacing || 0
      session.term.options.scrollback = resolved.profile.scrollback || 1000
      session.term.options.cursorStyle = resolved.profile.cursorStyle
      session.term.options.cursorBlink = resolved.profile.cursorBlink
      ;(session.term.options as typeof session.term.options & { fontLigatures?: boolean }).fontLigatures = settings.fontLigatures
      applyPerformanceMode(session, settings.termHighPerformance)
      session.containerEl.style.backgroundColor = resolved.theme.background ?? ''
      const preferredFont = resolved.fontFamily.split(',')[0]?.trim()
      stabilizeTerminalLayout(session, preferredFont)
      safeFit(session)
      setTimeout(updateCellHeight, 50)
    }

    const unsub1 = useTerminalProfileStore.subscribe(applyProfile)
    const unsubTheme = useThemeStore.subscribe((state, prev) => {
      if (state.runtimeVersion !== prev.runtimeVersion || state.customThemes !== prev.customThemes) {
        applyProfile()
      }
    })
    const unsub2 = useSettingsStore.subscribe((state, prev) => {
      if (
        state.activeProfileId !== prev.activeProfileId ||
        state.termThemeLight !== prev.termThemeLight ||
        state.termThemeDark !== prev.termThemeDark ||
        state.fontLigatures !== prev.fontLigatures ||
        state.termFontFamily !== prev.termFontFamily ||
        state.termFontSize !== prev.termFontSize ||
        state.termLineHeight !== prev.termLineHeight ||
        state.termLetterSpacing !== prev.termLetterSpacing ||
        state.termScrollback !== prev.termScrollback ||
        state.termCursorStyle !== prev.termCursorStyle ||
        state.termCursorBlink !== prev.termCursorBlink ||
        state.termHighPerformance !== prev.termHighPerformance ||
        state.termStripeEnabled !== prev.termStripeEnabled
      ) {
        applyProfile()
      }
    })
    return () => {
      unsub1()
      unsubTheme()
      unsub2()
    }
  }, [applyPerformanceMode, paneId, profileId, safeFit, stabilizeTerminalLayout, updateCellHeight])
}
