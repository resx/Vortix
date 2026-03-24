import { registerMenu } from '../../../registries/context-menu.registry'
import { MenuItem, MenuDivider } from '../components/MenuParts'
import { useShortcutStore } from '../../../stores/useShortcutStore'
import { useUIStore } from '../../../stores/useUIStore'
import { useToastStore } from '../../../stores/useToastStore'
import { icons } from '../../../components/icons/AppIcon'
import * as api from '../../../api/client'
import type { TreeItem } from '../../../types'
import { downloadJson, pickJsonFile } from '../menu-utils'

type ImportedShortcut = {
  name?: string
  command?: string
  remark?: string
  group_name?: string
  groupName?: string
}

const parseImportedShortcuts = (data: unknown): ImportedShortcut[] => {
  if (Array.isArray(data)) return data as ImportedShortcut[]
  if (data && typeof data === 'object' && Array.isArray((data as { shortcuts?: unknown[] }).shortcuts)) {
    return (data as { shortcuts: ImportedShortcut[] }).shortcuts
  }
  return [data as ImportedShortcut]
}

/* ---- 快捷命令右键菜单 ---- */
export function registerShortcutMenu(): () => void {
  return registerMenu({
    types: ['sidebar-shortcut', 'sidebar-blank-shortcut'],
    render: (ctx) => {
      const item = ctx.data as TreeItem | null
      const hideContextMenu = ctx.close
      const isItem = ctx.type === 'sidebar-shortcut' && item
      const isShortcut = isItem && item!.type === 'connection'
      const isGroup = isItem && item!.type === 'folder'
      const hasCommand = isShortcut && !!item!.command
      const currentGroupName = isGroup ? item!.name : (isShortcut ? item!.groupName : undefined)
      const groupChildren = isGroup ? (item!.children ?? []).filter((child) => child.type === 'connection') : []

      const {
        openShortcutDialog,
        openShortcutGroupDialog,
        deleteShortcutAction,
        deleteShortcutGroupAction,
        moveShortcutsToGroup,
        executeShortcut,
        fetchShortcuts,
      } = useShortcutStore.getState()
      const { openConfirmDialog } = useUIStore.getState()
      const { addToast } = useToastStore.getState()

      return (
        <>
          <div className="px-4 py-1 text-[11px] text-text-1 font-medium">快捷命令</div>
          <MenuItem
            icon={icons.link}
            label="新建快捷命令"
            onClick={() => {
              hideContextMenu()
              openShortcutDialog('create', undefined, currentGroupName)
            }}
          />
          <MenuItem
            icon={icons.folderPlus}
            label="新建分组"
            onClick={() => {
              hideContextMenu()
              openShortcutGroupDialog('create')
            }}
          />
          {isGroup && (
            <>
              <MenuItem
                icon={icons.edit}
                label="重命名分组"
                onClick={() => {
                  hideContextMenu()
                  openShortcutGroupDialog('rename', item!.id, item!.name)
                }}
              />
              <MenuItem
                icon={icons.folder}
                label="删除分组"
                onClick={() => {
                  hideContextMenu()
                  openConfirmDialog({
                    title: '删除分组',
                    description: `将分组“${item!.name}”下所有快捷命令移动到根级并删除该分组，是否继续？`,
                    confirmText: '确认删除',
                    danger: true,
                    onConfirm: async () => {
                      if (item!.id.startsWith('legacy-group:')) {
                        await moveShortcutsToGroup(groupChildren.map((child) => child.id), '')
                        return
                      }
                      await deleteShortcutGroupAction(item!.id)
                    },
                  })
                }}
              />
            </>
          )}
          <MenuDivider />
          <MenuItem icon={icons.terminal} label="执行" disabled={!hasCommand} onClick={hasCommand ? () => { hideContextMenu(); executeShortcut(item!.command!, 'execute') } : undefined} />
          <MenuItem icon={icons.clipboard} label="粘贴执行" disabled={!hasCommand} onClick={hasCommand ? () => { hideContextMenu(); executeShortcut(item!.command!, 'paste') } : undefined} />
          <MenuDivider />
          <MenuItem
            icon={icons.edit}
            label={isGroup ? '重命名分组' : '编辑'}
            disabled={!isItem}
            onClick={isItem ? () => {
              hideContextMenu()
              if (isGroup) {
                openShortcutGroupDialog('rename', item!.id, item!.name)
                return
              }
              openShortcutDialog('edit', item!.id)
            } : undefined}
          />
          <MenuItem
            icon={icons.fileX}
            label="删除"
            disabled={!isShortcut}
            onClick={isShortcut ? () => {
              hideContextMenu()
              openConfirmDialog({
                title: '删除快捷命令',
                description: '删除后不可恢复，确认删除吗？',
                confirmText: '确认删除',
                danger: true,
                onConfirm: async () => { await deleteShortcutAction(item!.id) },
              })
            } : undefined}
          />
          <MenuDivider />
          <MenuItem
            icon={icons.fileDown}
            label="导入"
            onClick={() => {
              hideContextMenu()
              pickJsonFile().then(async (data) => {
                const items = parseImportedShortcuts(data)
                let count = 0
                for (const it of items) {
                  if (!it.name || !it.command) continue
                  await api.createShortcut({
                    name: it.name,
                    command: it.command,
                    remark: it.remark,
                    group_name: (it.group_name ?? it.groupName ?? '').trim(),
                  })
                  count++
                }
                await fetchShortcuts()
                addToast('success', `导入 ${count} 条快捷命令`)
              }).catch(() => {})
            }}
          />
          <MenuItem
            icon={icons.fileUp}
            label="导出"
            disabled={!isItem}
            onClick={isItem ? () => {
              hideContextMenu()
              if (isGroup) {
                downloadJson(
                  groupChildren.map((child) => ({
                    name: child.name,
                    command: child.command,
                    remark: child.remark,
                    group_name: item!.name,
                  })),
                  `shortcut-group-${item!.name}.json`,
                )
                return
              }
              downloadJson([{
                name: item!.name,
                command: item!.command,
                remark: item!.remark,
                group_name: item!.groupName ?? '',
              }], `shortcut-${item!.name}.json`)
            } : undefined}
          />
          <MenuItem
            icon={icons.fileUp}
            label="导出全部"
            onClick={() => {
              hideContextMenu()
              api.getShortcuts().then((data) => {
                downloadJson(
                  data.map((s) => ({
                    name: s.name,
                    command: s.command,
                    remark: s.remark,
                    group_name: s.group_name ?? '',
                  })),
                  'vortix-shortcuts.json',
                )
              })
            }}
          />
        </>
      )
    },
  })
}
