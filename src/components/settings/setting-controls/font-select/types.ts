import { type RefObject } from 'react'
import { type SettingsState } from '../../../../stores/useSettingsStore'

export interface FontItem {
  value: string
  label: string
  family: string
  fontWeight?: string
}

export interface QueryLocalFontsEntry {
  family: string
}

export interface WindowWithLocalFonts extends Window {
  queryLocalFonts?: () => Promise<QueryLocalFontsEntry[]>
}

export interface SFontSelectProps {
  k?: keyof SettingsState
  label: string
  desc?: string
  value?: string[]
  onChangeFonts?: (fonts: string[]) => void
}

export interface FontSelectPosition {
  top: number
  left: number
}

export interface FontSelectGroups {
  selected: FontItem[]
  unselected: FontItem[]
}

export interface FontSelectPanelProps {
  panelRef: RefObject<HTMLDivElement | null>
  inputRef: RefObject<HTMLInputElement | null>
  pos: FontSelectPosition
  search: string
  setSearch: (value: string) => void
  isAllSelected: boolean
  isIndeterminate: boolean
  onToggleAll: () => void
  groups: FontSelectGroups
  selectedValues: string[]
  onReorder: (values: string[]) => void
  onToggleFont: (fontId: string) => void
}
