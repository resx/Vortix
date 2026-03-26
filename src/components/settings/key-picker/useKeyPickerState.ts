import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../../../api/client'
import type { SshKey } from '../../../api/types'
import type { KeyPickerState, TabView } from './types'

export function useKeyPickerState(): KeyPickerState {
  const [tab, setTab] = useState<TabView>('list')
  const [keys, setKeys] = useState<SshKey[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<SshKey | null>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    try {
      setKeys(await api.getSshKeys())
    } catch {
      setKeys([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKeys()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadKeys])

  const handleEdit = useCallback((key: SshKey) => {
    setEditingKey(key)
    setTab('edit')
  }, [])

  const handleBackToList = useCallback(() => {
    setTab('list')
    setEditingKey(null)
  }, [])

  const tabTitle = useMemo(() => {
    if (tab === 'list') return 'SSH 密钥'
    if (tab === 'generate') return '生成密钥'
    if (tab === 'import') return '导入密钥'
    return '编辑密钥'
  }, [tab])

  return {
    tab,
    setTab,
    keys,
    loading,
    editingKey,
    loadKeys,
    handleEdit,
    handleBackToList,
    tabTitle,
  }
}
