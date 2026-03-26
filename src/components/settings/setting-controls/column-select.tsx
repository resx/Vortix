import { useEffect, useRef, useState } from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { useSettingsStore, type SettingsState } from '../../../stores/useSettingsStore'
import { cn } from '../../../lib/utils'
import { AppIcon, icons } from '../../icons/AppIcon'
import { SettingRow } from '../SettingGroup'

const FILE_COLUMNS = [
  { key: 'name', label: '名称' },
  { key: 'mtime', label: '修改时间' },
  { key: 'type', label: '类型' },
  { key: 'size', label: '大小' },
  { key: 'perm', label: '权限' },
  { key: 'owner', label: '所有者/组' },
]

export function SColumnSelect({ k, label }: { k: keyof SettingsState; label: string }) {
  const storeValue = useSettingsStore((state) => state[k]) as string[]
  const update = useSettingsStore((state) => state.updateSetting)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [triggerWidth, setTriggerWidth] = useState(200)
  const isSftpColumnDisplay = k === 'sftpRemoteColumns' || k === 'sftpLocalColumns'

  const checked = new Set(storeValue)

  const toggle = (key: string) => {
    const next = new Set(checked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    update(k, Array.from(next) as never)
  }

  const selectedLabels = FILE_COLUMNS.filter((column) => checked.has(column.key)).map((column) => column.label)
  const selectedText = selectedLabels.join(',')
  const selectedCount = selectedLabels.length

  const sftpVisibleCount = (() => {
    if (!isSftpColumnDisplay || selectedCount === 0) return 0
    if (triggerWidth >= 156) return Math.min(2, selectedCount)
    if (triggerWidth >= 116) return 1
    return 0
  })()

  const sftpMainText = sftpVisibleCount > 0
    ? selectedLabels.slice(0, sftpVisibleCount).join('、')
    : (selectedCount > 0 ? `${selectedCount} 项` : '未选择')
  const sftpExtraCount = selectedCount - sftpVisibleCount

  const displayText = (() => {
    if (selectedCount === 0) return '未选择'
    if (isSftpColumnDisplay) return sftpMainText
    if (triggerWidth >= 180) return selectedText
    if (triggerWidth >= 120) {
      const head = selectedLabels.slice(0, 2)
      const rest = selectedCount - head.length
      return rest > 0 ? `${head.join(',')} +${rest}` : head.join(',')
    }
    return `已选 ${selectedCount} 项`
  })()

  useEffect(() => {
    const element = triggerRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const updateWidth = () => {
      const next = Math.round(element.getBoundingClientRect().width)
      setTriggerWidth((prev) => (prev === next ? prev : next))
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <SettingRow label={label}>
      <DropdownMenuPrimitive.Root open={open} onOpenChange={setOpen}>
        <DropdownMenuPrimitive.Trigger
          ref={triggerRef}
          title={selectedText || '未选择'}
          className={cn(
            'island-control inline-flex h-[26px] cursor-pointer items-center gap-1 overflow-hidden px-2 text-[12px] text-text-2 outline-none transition-colors hover:text-text-1 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary/40',
            isSftpColumnDisplay ? 'ml-auto w-[176px] min-w-[120px] max-w-[176px] justify-end' : 'w-[200px] min-w-[96px] max-w-[36vw] justify-between',
          )}
        >
          <span className={cn('min-w-0 truncate', isSftpColumnDisplay && 'text-right')}>{displayText}</span>
          {isSftpColumnDisplay && sftpExtraCount > 0 && (
            <span className="shrink-0 rounded-md border border-border/80 bg-bg-base px-1.5 py-[1px] text-[10px] leading-none text-text-3">
              +{sftpExtraCount}
            </span>
          )}
          {open
            ? <AppIcon icon={icons.chevronUp} size={14} className="shrink-0" />
            : <AppIcon icon={icons.chevronDown} size={14} className="shrink-0" />}
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            side="bottom"
            align="end"
            sideOffset={4}
            className="glass-context z-[1050] animate-in rounded-lg py-1 fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {FILE_COLUMNS.map((column) => (
              <DropdownMenuPrimitive.CheckboxItem
                key={column.key}
                checked={checked.has(column.key)}
                onCheckedChange={() => toggle(column.key)}
                onSelect={(event) => event.preventDefault()}
                className="flex cursor-pointer select-none items-center gap-2.5 px-3 py-1.5 text-[13px] text-text-1 outline-none data-[highlighted]:bg-bg-active"
              >
                <div
                  className={cn(
                    'flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                    checked.has(column.key) ? 'border-primary bg-primary' : 'border-text-disabled bg-bg-card',
                  )}
                >
                  {checked.has(column.key) && <AppIcon icon={icons.check} size={11} className="text-white" />}
                </div>
                {column.label}
              </DropdownMenuPrimitive.CheckboxItem>
            ))}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </SettingRow>
  )
}
