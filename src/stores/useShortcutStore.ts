import { create } from 'zustand'
import type { TreeItem } from '../types'
import type { ShortcutGroup, UpdateShortcutDto } from '../api/types'
import * as api from '../api/client'
import { useWorkspaceStore } from './useWorkspaceStore'
import { getSession } from './terminalSessionRegistry'
import type { TerminalSocketLike } from './terminalSessionRegistry'
import { useTabStore } from './useTabStore'

const normalizeGroupName = (value?: string | null) => (value ?? '').trim()

const buildShortcutTree = (
  shortcuts: Awaited<ReturnType<typeof api.getShortcuts>>,
  groups: ShortcutGroup[],
  prev: TreeItem[],
): TreeItem[] => {
  const openGroupIds = new Set(
    prev
      .filter((item) => item.type === 'folder' && item.isOpen)
      .map((item) => item.id),
  )

  const groupFolders = new Map<string, TreeItem>()
  const orderedFolders: TreeItem[] = []

  for (const group of groups) {
    const name = normalizeGroupName(group.name)
    if (!name) continue
    const folder: TreeItem = {
      id: group.id,
      name,
      type: 'folder',
      isOpen: openGroupIds.has(group.id),
      children: [],
      groupName: name,
    }
    groupFolders.set(name, folder)
    orderedFolders.push(folder)
  }

  const rootItems: TreeItem[] = []
  for (const shortcut of shortcuts) {
    const groupName = normalizeGroupName(shortcut.group_name)
    const item: TreeItem = {
      id: shortcut.id,
      name: shortcut.name,
      type: 'connection',
      protocol: 'local',
      command: shortcut.command,
      remark: shortcut.remark,
      groupName: groupName || undefined,
    }

    if (!groupName) {
      rootItems.push(item)
      continue
    }

    let folder = groupFolders.get(groupName)
    if (!folder) {
      // 兜底：兼容分组表尚未同步时的历史数据
      folder = {
        id: `legacy-group:${groupName}`,
        name: groupName,
        type: 'folder',
        isOpen: openGroupIds.has(`legacy-group:${groupName}`),
        children: [],
        groupName,
      }
      groupFolders.set(groupName, folder)
      orderedFolders.push(folder)
    }
    folder.children = [...(folder.children ?? []), item]
  }

  return [...orderedFolders, ...rootItems]
}

const toggleInTree = (items: TreeItem[], id: string): TreeItem[] =>
  items.map((item) => (
    item.id === id && item.type === 'folder'
      ? { ...item, isOpen: !item.isOpen }
      : item
  ))

interface ShortcutState {
  // 快捷命令
  shortcuts: TreeItem[]
  shortcutGroups: ShortcutGroup[]
  fetchShortcuts: () => Promise<void>
  fetchShortcutGroups: () => Promise<void>
  createShortcutAction: (name: string, command: string, remark?: string, groupName?: string) => Promise<void>
  deleteShortcutAction: (id: string) => Promise<void>
  updateShortcutAction: (id: string, data: UpdateShortcutDto) => Promise<void>
  moveShortcutsToGroup: (ids: string[], groupName?: string) => Promise<void>
  executeShortcut: (command: string, mode: 'execute' | 'paste') => void
  toggleShortcutGroup: (id: string) => void
  expandShortcutGroups: () => void
  collapseShortcutGroups: () => void

  // 分组 CRUD
  createShortcutGroupAction: (name: string) => Promise<void>
  renameShortcutGroupAction: (id: string, name: string) => Promise<void>
  deleteShortcutGroupAction: (id: string) => Promise<void>

  // 快捷命令对话框
  shortcutDialogOpen: boolean
  shortcutDialogMode: 'create' | 'edit'
  shortcutDialogInitialId: string | null
  shortcutDialogInitialGroupName: string | null
  openShortcutDialog: (mode: 'create' | 'edit', id?: string, groupName?: string) => void
  closeShortcutDialog: () => void

  // 分组对话框（岛屿风）
  shortcutGroupDialogOpen: boolean
  shortcutGroupDialogMode: 'create' | 'rename'
  shortcutGroupDialogGroupId: string | null
  shortcutGroupDialogInitialName: string
  openShortcutGroupDialog: (mode: 'create' | 'rename', groupId?: string, initialName?: string) => void
  closeShortcutGroupDialog: () => void

  // 多选
  selectedShortcutIds: string[]
  lastSelectedShortcutId: string | null
  setShortcutSelection: (ids: string[], lastSelectedId?: string | null) => void
  clearShortcutSelection: () => void
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  shortcuts: [],
  shortcutGroups: [],

  fetchShortcuts: async () => {
    try {
      const [shortcuts, groups] = await Promise.all([
        api.getShortcuts(),
        api.getShortcutGroups(),
      ])
      const nextTree = buildShortcutTree(shortcuts, groups, get().shortcuts)
      set({ shortcuts: nextTree, shortcutGroups: groups })
    } catch {
      // 忽略异常
    }
  },

  fetchShortcutGroups: async () => {
    const groups = await api.getShortcutGroups()
    const shortcuts = await api.getShortcuts()
    const nextTree = buildShortcutTree(shortcuts, groups, get().shortcuts)
    set({ shortcuts: nextTree, shortcutGroups: groups })
  },

  createShortcutAction: async (name, command, remark, groupName) => {
    await api.createShortcut({
      name,
      command,
      remark,
      group_name: normalizeGroupName(groupName),
    })
    await get().fetchShortcuts()
  },

  deleteShortcutAction: async (id) => {
    await api.deleteShortcut(id)
    await get().fetchShortcuts()
    set((s) => ({
      selectedShortcutIds: s.selectedShortcutIds.filter((x) => x !== id),
      lastSelectedShortcutId: s.lastSelectedShortcutId === id ? null : s.lastSelectedShortcutId,
    }))
  },

  updateShortcutAction: async (id, data) => {
    await api.updateShortcut(id, {
      ...data,
      group_name: data.group_name === undefined ? undefined : normalizeGroupName(data.group_name),
    })
    await get().fetchShortcuts()
  },

  moveShortcutsToGroup: async (ids, groupName) => {
    const uniqIds = [...new Set(ids.filter(Boolean))]
    if (uniqIds.length === 0) return
    const normalizedGroup = normalizeGroupName(groupName)
    const currentGroupById = new Map<string, string>()
    for (const item of get().shortcuts) {
      if (item.type === 'folder') {
        const group = normalizeGroupName(item.groupName ?? item.name)
        for (const child of item.children ?? []) {
          currentGroupById.set(child.id, group)
        }
      } else {
        currentGroupById.set(item.id, '')
      }
    }
    const toUpdate = uniqIds.filter((id) => normalizeGroupName(currentGroupById.get(id)) !== normalizedGroup)
    if (toUpdate.length === 0) {
      set({ selectedShortcutIds: uniqIds, lastSelectedShortcutId: uniqIds[uniqIds.length - 1] ?? null })
      return
    }
    await Promise.all(
      toUpdate.map((id) => api.updateShortcut(id, { group_name: normalizedGroup })),
    )
    await get().fetchShortcuts()
    set({ selectedShortcutIds: uniqIds, lastSelectedShortcutId: uniqIds[uniqIds.length - 1] ?? null })
  },

  executeShortcut: (command, mode) => {
    // activeTabId 来自 useTabStore
    const { activeTabId } = useTabStore.getState()
    const session = getSession(activeTabId)
    const wsStore = useWorkspaceStore.getState()
    const paneIds = wsStore.getAllPaneIds(activeTabId)
    let ws: TerminalSocketLike | null = null
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

  toggleShortcutGroup: (id) => set((s) => ({ shortcuts: toggleInTree(s.shortcuts, id) })),
  expandShortcutGroups: () => set((s) => ({
    shortcuts: s.shortcuts.map((item) => (item.type === 'folder' ? { ...item, isOpen: true } : item)),
  })),
  collapseShortcutGroups: () => set((s) => ({
    shortcuts: s.shortcuts.map((item) => (item.type === 'folder' ? { ...item, isOpen: false } : item)),
  })),

  createShortcutGroupAction: async (name) => {
    const normalized = normalizeGroupName(name)
    if (!normalized) return
    await api.createShortcutGroup({ name: normalized })
    await get().fetchShortcuts()
  },
  renameShortcutGroupAction: async (id, name) => {
    const normalized = normalizeGroupName(name)
    if (!normalized) return
    await api.updateShortcutGroup(id, { name: normalized })
    await get().fetchShortcuts()
  },
  deleteShortcutGroupAction: async (id) => {
    await api.deleteShortcutGroup(id)
    await get().fetchShortcuts()
  },

  // 快捷命令对话框
  shortcutDialogOpen: false,
  shortcutDialogMode: 'create',
  shortcutDialogInitialId: null,
  shortcutDialogInitialGroupName: null,
  openShortcutDialog: (mode, id, groupName) => set({
    shortcutDialogOpen: true,
    shortcutDialogMode: mode,
    shortcutDialogInitialId: id ?? null,
    shortcutDialogInitialGroupName: normalizeGroupName(groupName) || null,
  }),
  closeShortcutDialog: () => set({
    shortcutDialogOpen: false,
    shortcutDialogInitialId: null,
    shortcutDialogInitialGroupName: null,
  }),

  // 分组对话框（岛屿风）
  shortcutGroupDialogOpen: false,
  shortcutGroupDialogMode: 'create',
  shortcutGroupDialogGroupId: null,
  shortcutGroupDialogInitialName: '',
  openShortcutGroupDialog: (mode, groupId, initialName) => set({
    shortcutGroupDialogOpen: true,
    shortcutGroupDialogMode: mode,
    shortcutGroupDialogGroupId: groupId ?? null,
    shortcutGroupDialogInitialName: normalizeGroupName(initialName),
  }),
  closeShortcutGroupDialog: () => set({
    shortcutGroupDialogOpen: false,
    shortcutGroupDialogMode: 'create',
    shortcutGroupDialogGroupId: null,
    shortcutGroupDialogInitialName: '',
  }),

  // 多选
  selectedShortcutIds: [],
  lastSelectedShortcutId: null,
  setShortcutSelection: (ids, lastSelectedId) => set({
    selectedShortcutIds: [...new Set(ids)],
    lastSelectedShortcutId: lastSelectedId === undefined
      ? (ids.length ? ids[ids.length - 1] : null)
      : lastSelectedId,
  }),
  clearShortcutSelection: () => set({
    selectedShortcutIds: [],
    lastSelectedShortcutId: null,
  }),
}))
