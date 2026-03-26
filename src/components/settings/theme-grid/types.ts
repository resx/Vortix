import type { ITheme } from '@xterm/xterm'
import type { ThemeSource } from '../../../types/theme'

export type ThemeFilter = 'all' | 'favorites' | 'builtin' | 'custom'

export interface ThemeCardItem {
  id: string
  name: string
  source: ThemeSource
  theme: ITheme
}
