import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ── Radix Select 标准组件 ── */

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value
const SelectGroup = SelectPrimitive.Group

/* ── Trigger ── */

const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex items-center gap-1 cursor-pointer text-text-2 hover:text-text-1 transition-colors',
      'text-[13px] outline-none',
      'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown size={14} className="shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

/* ── Content ── */

const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      side="bottom"
      align="end"
      sideOffset={4}
      className={cn(
        'z-[1050] overflow-hidden glass-context rounded-lg',
        'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="max-h-[240px] overflow-y-auto py-1 custom-scrollbar">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

/* ── Item ── */

const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex items-center px-3 py-1.5 text-[13px] cursor-pointer select-none outline-none transition-colors',
      'text-text-1 data-[state=checked]:bg-bg-active data-[state=checked]:text-primary',
      'data-[highlighted]:bg-bg-active',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="ml-auto pl-2">
      <Check size={14} />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

/* ── SettingsDropdown（向后兼容封装） ── */

interface SettingsDropdownProps {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  width?: string
}

function SettingsDropdown({ value, options, onChange, width = 'w-auto' }: SettingsDropdownProps) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent className={width}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SettingsDropdown,
}
