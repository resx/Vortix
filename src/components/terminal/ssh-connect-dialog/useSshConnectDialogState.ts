import { useEffect, useMemo, useState } from 'react'
import * as api from '../../../api/client'
import { useAssetStore } from '../../../stores/useAssetStore'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import { useTabStore } from '../../../stores/useTabStore'
import { useUIStore } from '../../../stores/useUIStore'
import { DEFAULT_SSH_CONNECT_STATE } from './constants'
import type { DialogMode, SshConnectDialogProps, SshConnectDialogState } from './types'

function toInitialState(initialData?: SshConnectDialogProps['initialData']): SshConnectDialogState {
  if (!initialData) return DEFAULT_SSH_CONNECT_STATE
  return {
    ...DEFAULT_SSH_CONNECT_STATE,
    name: initialData.name || '',
    folderId: initialData.folder_id ?? null,
    host: initialData.host || '',
    port: String(initialData.port || 22),
    username: initialData.username || 'root',
    authType: initialData.auth_method || 'password',
    remark: initialData.remark || '',
  }
}

export function useSshConnectDialogState({
  open,
  mode,
  onClose,
  initialData,
}: Pick<SshConnectDialogProps, 'open' | 'mode' | 'onClose' | 'initialData'>) {
  const openQuickConnect = useTabStore((s) => s.openQuickConnect)
  const createConnectionAction = useAssetStore((s) => s.createConnectionAction)
  const fetchAssets = useAssetStore((s) => s.fetchAssets)
  const [state, setState] = useState<SshConnectDialogState>(DEFAULT_SSH_CONNECT_STATE)

  useEffect(() => {
    if (!open) return
    setState(toInitialState(initialData))
  }, [open, initialData])

  useEffect(() => {
    if (!open || mode === 'quick') return
    api.getFolders().then((folders) => {
      setState((prev) => ({ ...prev, folders }))
    }).catch(() => {})
  }, [open, mode])

  const title = useMemo(() => {
    if (mode === 'quick') return '快速连接'
    if (mode === 'save') return '新建连接'
    return '编辑连接'
  }, [mode])

  const setField = <K extends keyof SshConnectDialogState>(key: K, value: SshConnectDialogState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const openAdvancedConfig = () => {
    const { prefillFromQuickConnect } = useSshConfigStore.getState()
    prefillFromQuickConnect({
      host: state.host,
      port: state.port,
      user: state.username,
      password: state.password,
      authType: state.authType,
    })
    onClose()
    useUIStore.getState().openSshConfig('create', undefined, true)
  }

  const doQuickConnect = () => {
    openQuickConnect({
      host: state.host,
      port: Number(state.port) || 22,
      username: state.username,
      ...(state.authType === 'password' ? { password: state.password } : { privateKey: state.privateKey }),
    })
    onClose()
  }

  const handleSave = async (andConnect: boolean) => {
    setField('saving', true)
    try {
      await createConnectionAction({
        name: state.name || `${state.host}:${state.port}`,
        folder_id: state.folderId,
        host: state.host,
        port: Number(state.port) || 22,
        username: state.username,
        auth_method: state.authType,
        ...(state.authType === 'password' ? { password: state.password } : { private_key: state.privateKey }),
        remark: state.remark,
      })
      if (andConnect) doQuickConnect()
      onClose()
    } catch (e) {
      console.error('保存连接失败', e)
    } finally {
      setField('saving', false)
    }
  }

  const handleEdit = async () => {
    if (!initialData?.id) return
    setField('saving', true)
    try {
      await api.updateConnection(initialData.id, {
        name: state.name || `${state.host}:${state.port}`,
        folder_id: state.folderId,
        host: state.host,
        port: Number(state.port) || 22,
        username: state.username,
        auth_method: state.authType,
        ...(state.authType === 'password' && state.password ? { password: state.password } : {}),
        ...(state.authType === 'key' && state.privateKey ? { private_key: state.privateKey } : {}),
        remark: state.remark,
      })
      await fetchAssets()
      onClose()
    } catch (e) {
      console.error('更新连接失败', e)
    } finally {
      setField('saving', false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'quick') doQuickConnect()
    if (mode === 'edit') void handleEdit()
  }

  return {
    state,
    title,
    setField,
    handleSubmit,
    handleSave,
    handleEdit,
    openAdvancedConfig,
    isQuickMode: mode === 'quick',
    isSaveMode: mode === 'save',
    isEditMode: mode === 'edit',
  }
}

export type UseSshConnectDialogStateReturn = ReturnType<typeof useSshConnectDialogState>
export type SshConnectDialogMode = DialogMode
