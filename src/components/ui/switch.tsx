import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../../lib/utils'

/* ── Switch（Radix 标准） ── */

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex w-[36px] h-[20px] shrink-0 cursor-pointer rounded-full transition-colors duration-200 border border-transparent',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-border data-[state=unchecked]:border-border',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'pointer-events-none block w-[16px] h-[16px] rounded-full bg-bg-card shadow-sm transition-transform duration-200',
        'data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-[2px]',
        'mt-[2px]',
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

/* ── Toggle（向后兼容别名） ── */

interface ToggleProps {
  checked: boolean
  onChange: () => void
  className?: string
}

function Toggle({ checked, onChange, className }: ToggleProps) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      className={className}
    />
  )
}

export { Switch, Toggle }
