import { useEffect, useMemo, useState } from 'react'
import IslandModal from '../ui/island-modal'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { useToastStore } from '../../stores/useToastStore'

export default function ShortcutDialog() {
  const shortcutDialogOpen = useShortcutStore((s) => s.shortcutDialogOpen)
  const shortcutGroupDialogOpen = useShortcutStore((s) => s.shortcutGroupDialogOpen)
  if (!shortcutDialogOpen && !shortcutGroupDialogOpen) return null
  return (
    <>
      <ShortcutCommandDialog />
      <ShortcutGroupDialog />
    </>
  )
}

function ShortcutCommandDialog() {
  const open = useShortcutStore((s) => s.shortcutDialogOpen)
  const mode = useShortcutStore((s) => s.shortcutDialogMode)
  const initialId = useShortcutStore((s) => s.shortcutDialogInitialId)
  const initialGroupName = useShortcutStore((s) => s.shortcutDialogInitialGroupName)
  const close = useShortcutStore((s) => s.closeShortcutDialog)
  const shortcuts = useShortcutStore((s) => s.shortcuts)
  const groups = useShortcutStore((s) => s.shortcutGroups)
  const createShortcutAction = useShortcutStore((s) => s.createShortcutAction)
  const updateShortcutAction = useShortcutStore((s) => s.updateShortcutAction)

  const flatShortcuts = useMemo(
    () => shortcuts.flatMap((item) => (item.type === 'folder' ? (item.children ?? []) : [item])),
    [shortcuts],
  )
  const groupOptions = useMemo(() => {
    const names = new Set<string>()
    for (const g of groups) {
      if (g.name.trim()) names.add(g.name.trim())
    }
    for (const item of shortcuts) {
      if (item.type === 'folder' && item.name.trim()) names.add(item.name.trim())
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [groups, shortcuts])

  if (!open) return null

  const initialShortcut = mode === 'edit' && initialId
    ? flatShortcuts.find((s) => s.id === initialId) ?? null
    : null

  return (
    <ShortcutDialogContent
      key={`${mode}-${initialId ?? 'new'}-${initialGroupName ?? ''}`}
      mode={mode}
      initialId={initialId}
      initialShortcut={initialShortcut}
      initialGroupName={initialGroupName}
      close={close}
      createShortcutAction={createShortcutAction}
      updateShortcutAction={updateShortcutAction}
      groupOptions={groupOptions}
    />
  )
}

function ShortcutDialogContent({
  mode,
  initialId,
  initialShortcut,
  initialGroupName,
  close,
  createShortcutAction,
  updateShortcutAction,
  groupOptions,
}: {
  mode: ReturnType<typeof useShortcutStore.getState>['shortcutDialogMode']
  initialId: string | null
  initialShortcut: ReturnType<typeof useShortcutStore.getState>['shortcuts'][number] | null
  initialGroupName: string | null
  close: ReturnType<typeof useShortcutStore.getState>['closeShortcutDialog']
  createShortcutAction: ReturnType<typeof useShortcutStore.getState>['createShortcutAction']
  updateShortcutAction: ReturnType<typeof useShortcutStore.getState>['updateShortcutAction']
  groupOptions: string[]
}) {
  const [name, setName] = useState(() => initialShortcut?.name ?? '')
  const [command, setCommand] = useState(() => initialShortcut?.command ?? '')
  const [remark, setRemark] = useState(() => initialShortcut?.remark ?? '')
  const [groupName, setGroupName] = useState(() => initialShortcut?.groupName ?? initialGroupName ?? '')
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false)

  const normalizedInput = groupName.trim().toLowerCase()
  const filteredGroups = useMemo(
    () => groupOptions.filter((g) => g.toLowerCase().includes(normalizedInput)),
    [groupOptions, normalizedInput],
  )
  const hasExactGroup = useMemo(
    () => !!normalizedInput && groupOptions.some((g) => g.toLowerCase() === normalizedInput),
    [groupOptions, normalizedInput],
  )
  const showCreateGroup = !!normalizedInput && !hasExactGroup

  const handleSave = async () => {
    if (!name.trim() || !command.trim()) return
    const normalizedGroup = groupName.trim()
    if (mode === 'create') {
      await createShortcutAction(name.trim(), command.trim(), remark.trim(), normalizedGroup)
    } else if (initialId) {
      await updateShortcutAction(initialId, {
        name: name.trim(),
        command: command.trim(),
        remark: remark.trim(),
        group_name: normalizedGroup,
      })
    }
    close()
  }

  return (
    <IslandModal
      title={mode === 'create' ? '新建快捷命令' : '编辑快捷命令'}
      isOpen
      onClose={close}
      width="max-w-[460px]"
      padding="px-5 py-4"
      footer={(
        <div className="w-full flex justify-end gap-3">
          <button className="island-btn px-3.5 py-1.5 text-text-2 rounded-lg text-[12px] font-medium transition-colors" onClick={close}>
            取消
          </button>
          <button
            className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white bg-primary hover:opacity-90 transition-opacity disabled:opacity-60"
            onClick={handleSave}
            disabled={!name.trim() || !command.trim()}
          >
            保存
          </button>
        </div>
      )}
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-text-2 font-medium">名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入快捷命令名称"
            className="h-[32px] border border-border bg-bg-base rounded-lg px-3 text-[13px] text-text-1 outline-none focus:border-primary transition-colors placeholder-text-disabled"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1 relative">
          <label className="text-[12px] text-text-2 font-medium">分组</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => {
              setGroupName(e.target.value)
              setGroupDropdownOpen(true)
            }}
            onFocus={() => setGroupDropdownOpen(true)}
            onBlur={() => setTimeout(() => setGroupDropdownOpen(false), 120)}
            placeholder="可输入搜索分组，留空表示不分组"
            className="h-[32px] border border-border bg-bg-base rounded-lg px-3 text-[13px] text-text-1 outline-none focus:border-primary transition-colors placeholder-text-disabled"
          />
          {groupDropdownOpen && (
            <div className="absolute top-[60px] z-20 bg-bg-base border border-border rounded-lg shadow-lg w-full max-h-[180px] overflow-y-auto custom-scrollbar">
              {filteredGroups.map((g) => (
                <button
                  key={g}
                  type="button"
                  className="w-full text-left px-3 py-2 text-[12px] text-text-1 hover:bg-bg-hover transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setGroupName(g)
                    setGroupDropdownOpen(false)
                  }}
                >
                  {g}
                </button>
              ))}
              {showCreateGroup && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-[12px] text-primary hover:bg-bg-hover transition-colors border-t border-border/70"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setGroupName(groupName.trim())
                    setGroupDropdownOpen(false)
                  }}
                >
                  新建分组: {groupName.trim()}
                </button>
              )}
              {!filteredGroups.length && !showCreateGroup && (
                <div className="px-3 py-2 text-[12px] text-text-3">没有匹配分组</div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-text-2 font-medium">命令</label>
          <textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="请输入命令内容，支持多行"
            rows={4}
            className="border border-border bg-bg-base rounded-lg px-3 py-2 text-[13px] text-text-1 outline-none focus:border-primary transition-colors placeholder-text-disabled font-mono resize-y min-h-[80px] max-h-[300px] overflow-y-auto cmd-textarea-scrollbar"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[12px] text-text-2 font-medium">备注</label>
          <input
            type="text"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="可选备注"
            className="h-[32px] border border-border bg-bg-base rounded-lg px-3 text-[13px] text-text-1 outline-none focus:border-primary transition-colors placeholder-text-disabled"
          />
        </div>
      </div>
    </IslandModal>
  )
}

function ShortcutGroupDialog() {
  const open = useShortcutStore((s) => s.shortcutGroupDialogOpen)
  const mode = useShortcutStore((s) => s.shortcutGroupDialogMode)
  const groupId = useShortcutStore((s) => s.shortcutGroupDialogGroupId)
  const initialName = useShortcutStore((s) => s.shortcutGroupDialogInitialName)
  const close = useShortcutStore((s) => s.closeShortcutGroupDialog)
  const createGroup = useShortcutStore((s) => s.createShortcutGroupAction)
  const renameGroup = useShortcutStore((s) => s.renameShortcutGroupAction)
  const addToast = useToastStore((s) => s.addToast)
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])

  if (!open) return null

  const handleSave = async () => {
    const normalized = name.trim()
    if (!normalized || saving) return
    setSaving(true)
    try {
      if (mode === 'create') {
        await createGroup(normalized)
      } else if (groupId) {
        await renameGroup(groupId, normalized)
      }
      close()
    } catch (error) {
      addToast('error', (error as Error).message || '分组操作失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <IslandModal
      title={mode === 'create' ? '新建分组' : '重命名分组'}
      isOpen
      onClose={saving ? () => {} : close}
      width="max-w-[420px]"
      padding="px-5 py-4"
      footer={(
        <div className="w-full flex justify-end gap-3">
          <button
            className="island-btn px-3.5 py-1.5 text-text-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-60"
            onClick={close}
            disabled={saving}
          >
            取消
          </button>
          <button
            className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white bg-primary hover:opacity-90 transition-opacity disabled:opacity-60"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            保存
          </button>
        </div>
      )}
    >
      <div className="flex flex-col gap-1">
        <label className="text-[12px] text-text-2 font-medium">分组名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="请输入分组名称"
          className="h-[32px] border border-border bg-bg-base rounded-lg px-3 text-[13px] text-text-1 outline-none focus:border-primary transition-colors placeholder-text-disabled"
          autoFocus
        />
      </div>
    </IslandModal>
  )
}
