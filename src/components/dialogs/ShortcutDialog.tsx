/* ── 快捷命令编辑对话框 ── */

import { useState, useEffect } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { useShortcutStore } from '../../stores/useShortcutStore'

export default function ShortcutDialog() {
  const open = useShortcutStore((s) => s.shortcutDialogOpen)
  const mode = useShortcutStore((s) => s.shortcutDialogMode)
  const initialId = useShortcutStore((s) => s.shortcutDialogInitialId)
  const close = useShortcutStore((s) => s.closeShortcutDialog)
  const shortcuts = useShortcutStore((s) => s.shortcuts)
  const createShortcutAction = useShortcutStore((s) => s.createShortcutAction)
  const updateShortcutAction = useShortcutStore((s) => s.updateShortcutAction)

  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [remark, setRemark] = useState('')

  useEffect(() => {
    if (open && mode === 'edit' && initialId) {
      const item = shortcuts.find(s => s.id === initialId)
      if (item) {
        setName(item.name)
        setCommand(item.command ?? '')
        setRemark(item.remark ?? '')
      }
    } else if (open && mode === 'create') {
      setName('')
      setCommand('')
      setRemark('')
    }
  }, [open, mode, initialId, shortcuts])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim() || !command.trim()) return
    if (mode === 'create') {
      await createShortcutAction(name.trim(), command.trim(), remark.trim())
    } else if (initialId) {
      await updateShortcutAction(initialId, {
        name: name.trim(),
        command: command.trim(),
        remark: remark.trim(),
      })
    }
    close()
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[999] flex items-center justify-center" onClick={close}>
      <div
        className="bg-bg-base rounded-xl shadow-2xl border border-border/60 w-[420px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <h3 className="text-[14px] font-bold text-text-1 flex items-center gap-2">
            <AppIcon icon={icons.terminal} size={15} className="text-primary" />
            {mode === 'create' ? '新建快捷命令' : '编辑快捷命令'}
          </h3>
          <button onClick={close} className="p-1.5 hover:bg-bg-hover rounded-md text-text-3 transition-colors">
            <AppIcon icon={icons.close} size={16} />
          </button>
        </div>

        {/* 内容岛屿 */}
        <div className="mx-4 bg-bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-text-2 font-medium">名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="快捷命令名称"
                className="h-[32px] border border-border bg-bg-base rounded-lg px-3 text-[13px] text-text-1 outline-none focus:border-primary transition-colors placeholder-text-disabled"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-text-2 font-medium">命令</label>
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="要执行的命令，支持多行"
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
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-3.5 flex justify-end gap-3">
          <button className="text-xs text-orange-500 hover:text-orange-600 transition-colors" onClick={close}>
            取消
          </button>
          <button
            className="text-xs font-medium text-primary hover:opacity-80 transition-colors disabled:opacity-40"
            onClick={handleSave}
            disabled={!name.trim() || !command.trim()}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}