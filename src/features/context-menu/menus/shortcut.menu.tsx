import { registerMenu } from '../../../registries/context-menu.registry'
import { MenuItem, MenuDivider } from '../components/MenuParts'
import { useShortcutStore } from '../../../stores/useShortcutStore'
import { useToastStore } from '../../../stores/useToastStore'
import { icons } from '../../../components/icons/AppIcon'
import * as api from '../../../api/client'
import type { TreeItem } from '../../../types'
import { downloadJson, pickJsonFile } from '../menu-utils'

/* ---- 注册快捷命令右键菜单 ---- */
export function registerShortcutMenu(): () => void {
  return registerMenu({
    types: ['sidebar-shortcut', 'sidebar-blank-shortcut'],
    render: (ctx) => {
      const item = ctx.data as TreeItem | null
      const hideContextMenu = ctx.close
      const isItem = ctx.type === 'sidebar-shortcut' && item
      const hasCommand = isItem && !!item!.command

      const { openShortcutDialog, deleteShortcutAction, executeShortcut, fetchShortcuts } = useShortcutStore.getState()
      const { addToast } = useToastStore.getState()

      return (
        <>
          <div className="px-4 py-1 text-[11px] text-text-1 font-medium">操作</div>
          <MenuItem icon={icons.link} label="新建快捷命令" onClick={() => { hideContextMenu(); openShortcutDialog('create') }} />
          <MenuItem icon={icons.folderPlus} label="新建分组" onClick={() => { hideContextMenu(); addToast('info', '分组功能即将推出') }} />
          <MenuDivider />
          <MenuItem icon={icons.terminal} label="执行" disabled={!hasCommand} onClick={hasCommand ? () => { hideContextMenu(); executeShortcut(item!.command!, 'execute') } : undefined} />
          <MenuItem icon={icons.clipboard} label="粘贴到终端" disabled={!hasCommand} onClick={hasCommand ? () => { hideContextMenu(); executeShortcut(item!.command!, 'paste') } : undefined} />
          <MenuDivider />
          <MenuItem icon={icons.edit} label="编辑" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); openShortcutDialog('edit', item!.id) } : undefined} />
          <MenuItem icon={icons.fileX} label="删除" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); if (confirm('确定要删除此快捷命令？')) deleteShortcutAction(item!.id) } : undefined} />
          <MenuDivider />
          <MenuItem icon={icons.fileDown} label="导入" onClick={() => { hideContextMenu(); pickJsonFile().then(async (data) => { const items = (Array.isArray(data) ? data : [data]) as { name?: string; command?: string; remark?: string }[]; let count = 0; for (const it of items) { if (it.name && it.command) { await api.createShortcut({ name: it.name, command: it.command, remark: it.remark }); count++ } } fetchShortcuts(); addToast('success', `成功导入 ${count} 条快捷命令`) }).catch(() => {}) }} />
          <MenuItem icon={icons.fileUp} label="导出" disabled={!isItem} onClick={isItem ? () => { hideContextMenu(); downloadJson([{ name: item!.name, command: item!.command, remark: item!.remark }], `shortcut-${item!.name}.json`) } : undefined} />
          <MenuItem icon={icons.fileUp} label="导出全部" onClick={() => { hideContextMenu(); api.getShortcuts().then(data => { downloadJson(data.map(s => ({ name: s.name, command: s.command, remark: s.remark })), 'vortix-shortcuts.json') }) }} />
        </>
      )
    },
  })
}