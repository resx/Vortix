import type { Dispatch, SetStateAction } from 'react'
import type { TerminalHighlightDisplayRule } from '../../../lib/terminal-highlight/panel'

export interface KeywordHighlightPanelState {
  rules: TerminalHighlightDisplayRule[]
  enabled: boolean
  editingId: string | null
  editingRule: TerminalHighlightDisplayRule | null
  formName: string
  setFormName: Dispatch<SetStateAction<string>>
  formPattern: string
  setFormPattern: Dispatch<SetStateAction<string>>
  formColor: string
  setFormColor: Dispatch<SetStateAction<string>>
  hasCustomRules: boolean
  isBuiltinEditing: boolean
  toggleEnabled: () => void
  handleEdit: (rule: TerminalHighlightDisplayRule) => void
  handleCancelEdit: () => void
  handleSave: () => void
  handleDelete: (id: string) => void
  handleClearCustom: () => void
}
