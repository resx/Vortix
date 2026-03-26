import type { Dispatch, SetStateAction } from 'react'
import type { SshKey } from '../../../api/types'

export interface KeyPickerModalProps {
  onSelect: (keyContent: string, meta?: { keyName?: string; keyId?: string }) => void
  onClose: () => void
}

export type KeyType = 'ed25519' | 'ecdsa' | 'rsa' | 'ml-dsa'
export type TabView = 'list' | 'generate' | 'import' | 'edit'

export interface KeyPickerState {
  tab: TabView
  setTab: Dispatch<SetStateAction<TabView>>
  keys: SshKey[]
  loading: boolean
  editingKey: SshKey | null
  loadKeys: () => Promise<void>
  handleEdit: (key: SshKey) => void
  handleBackToList: () => void
  tabTitle: string
}
