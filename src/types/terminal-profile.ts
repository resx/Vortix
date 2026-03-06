import type { ITheme } from '@xterm/xterm'

export const DEFAULT_PROFILE_ID = '__default__'

export interface TerminalProfile {
  id: string
  name: string
  isDefault: boolean
  colorSchemeLight: string
  colorSchemeDark: string
  fontFamily: string[]
  fontSize: number
  lineHeight: number
  letterSpacing: number
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  keywordHighlights: {
    error: string
    warning: string
    ok: string
    info: string
    debug: string
    ipMac: string
    path?: string
    url?: string
    timestamp?: string
    env?: string
  }
}

/** 解析后的 Profile，供 SshTerminal 直接消费 */
export interface ResolvedProfile {
  profile: TerminalProfile
  theme: ITheme
  fontFamily: string
}
