import { create } from 'zustand'
import type { TreeItem } from '../types'
import type { UpdateShortcutDto } from '../api/types'
import * as api from '../api/client'
import { useWorkspaceStore } from './useWorkspaceStore'
import { getSession } from './terminalSessionRegistry'
import { useTabStore } from './useTabStore'

interface ShortcutState {
  // 快捷命令数据
  shortcuts: TreeItem[]
  fetchShortcuts: () => Promise<void>
  createShortcutAction: (name: string, command: string, remark?: string) => Promise<void>
  deleteShortcutAction: (id: string) => Promise<void>
  updateShortcutAction: (id: string, data: UpdateShortcutDto) => Promise<void>
  executeShortcut: (command: string, mode: 'execute' | 'paste') => void

  // 快捷命令对话框
  shortcutDialogOpen: boolean
  shortcutDialogMode: 'create' | 'edit'
  shortcutDialogInitialId: string | null
  openShortcutDialog: (mode: 'create' | 'edit', id?: string) => void
  closeShortcutDialog: () => void
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  shortcuts: [],

  fetchShortcuts: async () => {
    try {
      const data = await api.getShortcuts()
      const items: TreeItem[] = data.map(s => ({
        id: s.id,
        name: s.name,
        type: 'connection' as const,
        command: s.command,
        remark: s.remark,
      }))
      set({ shortcuts: items })
    } catch {
      // 静默失败
    }
  },

  createShortcutAction: async (name, command, remark) => {
    await api.createShortcut({ name, command, remark })
    await get().fetchShortcuts()
  },

  deleteShortcutAction: async (id) => {
    await api.deleteShortcut(id)
    await get().fetchShortcuts()
  },

  updateShortcutAction: async (id, data) => {
    await api.updateShortcut(id, data)
    await get().fetchShortcuts()
  },

  executeShortcut: (command, mode) => {
    // activeTabId 来自 useTabStore
    const { activeTabId } = useTabStore.getState()
    const session = getSession(activeTabId)
    const wsStore = useWorkspaceStore.getState()
    const paneIds = wsStore.getAllPaneIds(activeTabId)
    let ws: WebSocket | null = null
    for (const pid of paneIds) {
      const s = getSession(pid)
      if (s?.ws?.readyState === WebSocket.OPEN) {
        ws = s.ws
        break
      }
    }
    if (!ws && session?.ws?.readyState === WebSocket.OPEN) {
      ws = session.ws
    }
    if (ws) {
      if (mode === 'execute') {
        const normalized = command
          .replace(/\\\s*\n\s*/g, '')
          .replace(/&\s*\n\s*&/g, '&&')
          .replace(/\|\s*\n\s*\|/g, '||')
          .replace(/\s*\n\s*/g, ' ')
          .trim()
        ws.send(JSON.stringify({ type: 'input', data: normalized + '\r' }))
      } else {
        const isMultiLine = command.includes('\n')
        if (isMultiLine) {
          const PASTE_START = '\x1b[200~'
          const PASTE_END = '\x1b[201~'
          const text = command.replace(/\n/g, '\r')
          ws.send(JSON.stringify({ type: 'input', data: PASTE_START + text + PASTE_END }))
        } else {
          ws.send(JSON.stringify({ type: 'input', data: command }))
        }
      }
    }
  },

  // 快捷命令对话框
  shortcutDialogOpen: false,
  shortcutDialogMode: 'create',
  shortcutDialogInitialId: null,
  openShortcutDialog: (mode, id) => set({ shortcutDialogOpen: true, shortcutDialogMode: mode, shortcutDialogInitialId: id ?? null }),
  closeShortcutDialog: () => set({ shortcutDialogOpen: false, shortcutDialogInitialId: null }),
}))