import type { Dispatch, SetStateAction } from 'react'
import type { TerminalHighlightRule } from '../../../stores/useSettingsStore'

export interface KeywordHighlightPanelState {
  rules: TerminalHighlightRule[]
  enabled: boolean
  editingId: string | null
  formName: string
  setFormName: Dispatch<SetStateAction<string>>
  formPattern: string
  setFormPattern: Dispatch<SetStateAction<string>>
  formColor: string
  setFormColor: Dispatch<SetStateAction<string>>
  hasCustomRules: boolean
  toggleEnabled: () => void
  handleEdit: (rule: TerminalHighlightRule) => void
  handleCancelEdit: () => void
  handleSave: () => void
  handleDelete: (id: string) => void
  handleClearCustom: () => void
}
