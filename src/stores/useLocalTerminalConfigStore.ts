import { create } from 'zustand'
import * as api from '../api/client'
import { useUIStore } from './useUIStore'
import { useAssetStore } from './useAssetStore'

/* ── 类型定义 ── */

export type ShellType = 'cmd' | 'bash' | 'powershell' | 'powershell7' | 'wsl' | 'zsh' | 'fish'

interface LocalTerminalConfigState {
  colorTag: string | null
  name: string
  shell: ShellType
  workingDir: string
  initialCommand: string
  remark: string

  editingId: string | null
  saving: boolean
  loading: boolean
  errors: Record<string, string>

  // 测试连接
  testing: boolean
  testResult: { success: boolean; message: string } | null

  setField: <K extends keyof LocalTerminalConfigState>(key: K, value: LocalTerminalConfigState[K]) => void
  validate: () => boolean
  reset: () => void
  save: () => Promise<void>
  loadFromConnection: (id: string) => Promise<void>
  testConnection: () => Promise<void>
}

const initialState = {
  colorTag: null as string | null,
  name: '',
  shell: 'powershell' as ShellType,
  workingDir: '',
  initialCommand: '',
  remark: '',
  editingId: null as string | null,
  saving: false,
  loading: false,
  errors: {} as Record<string, string>,
  testing: false,
  testResult: null as { success: boolean; message: string } | null,
}

export const useLocalTerminalConfigStore = create<LocalTerminalConfigState>((set, get) => ({
  ...initialState,

  setField: (key, value) => {
    set({ [key]: value } as Partial<LocalTerminalConfigState>)
    // 输入时清除对应错误
    if (key === 'name' && typeof value === 'string' && value.trim()) {
      set((s) => {
        const next = { ...s.errors }
        delete next.name
        return { errors: next }
      })
    }
  },

  validate: () => {
    const s = get()
    const errors: Record<string, string> = {}
    if (!s.name.trim()) errors.name = 'name is a required field'
    set({ errors })
    return Object.keys(errors).length === 0
  },
  reset: () => set({ ...initialState, errors: {}, testing: false, testResult: null }),

  save: async () => {
    const s = get()
    if (!s.validate()) return
    set({ saving: true })
    try {
      const appStore = useUIStore.getState()
      const assetStore = useAssetStore.getState()
      const isEdit = appStore.localTermConfigMode === 'edit' && !!s.editingId

      const payload = {
        name: s.name,
        protocol: 'local',
        host: 'localhost',
        port: 0,
        username: '',
        remark: s.remark,
        color_tag: s.colorTag,
        advanced: JSON.stringify({
          shell: s.shell,
          workingDir: s.workingDir,
          initialCommand: s.initialCommand,
        }),
        folder_id: assetStore.currentFolder,
      }

      if (isEdit) {
        await api.updateConnection(s.editingId!, payload)
      } else {
        await api.createConnection(payload)
      }

      await assetStore.fetchAssets()
      appStore.closeLocalTermConfig()
      get().reset()
    } catch {
      // 静默处理
    } finally {
      set({ saving: false })
    }
  },

  testConnection: async () => {
    const s = get()
    set({ testing: true, testResult: null })
    try {
      const result = await api.testLocalTerminal({
        shell: s.shell,
        workingDir: s.workingDir || undefined,
      })
      set({ testResult: { success: result.success, message: result.message || result.error || '' } })
    } catch (e) {
      set({ testResult: { success: false, message: (e as Error).message } })
    } finally {
      set({ testing: false })
    }
  },

  loadFromConnection: async (id) => {
    set({ loading: true })
    try {
      const conn = await api.getConnection(id)
      const adv = (conn.advanced && typeof conn.advanced === 'object') ? conn.advanced : {}

      set({
        editingId: id,
        name: conn.name,
        remark: conn.remark ?? '',
        colorTag: conn.color_tag,
        shell: ((adv as Record<string, unknown>).shell as ShellType) ?? 'powershell',
        workingDir: ((adv as Record<string, unknown>).workingDir as string) ?? '',
        initialCommand: ((adv as Record<string, unknown>).initialCommand as string) ?? '',
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },
}))
