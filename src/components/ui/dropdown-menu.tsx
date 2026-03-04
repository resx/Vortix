import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ── Variant Context ── */
type MenuVariant = 'default' | 'glass'

const VariantContext = React.createContext<MenuVariant>('default')

/* ── Re-exports ── */
const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuGroup = DropdownMenuPrimitive.Group

/* ── Content ── */
const contentVariants = cva(
  'z-[200] min-w-[200px] overflow-hidden rounded-xl py-1.5 text-[13px] text-text-1 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
  {
    variants: {
      variant: {
        default:
          'glass-context',
        glass: 'glass-dropdown',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

interface DropdownMenuContentProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>,
    VariantProps<typeof contentVariants> {}

const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  DropdownMenuContentProps
>(({ className, variant = 'default', sideOffset = 6, children, ...props }, ref) => (
  <VariantContext.Provider value={variant!}>
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(contentVariants({ variant }), className)}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  </VariantContext.Provider>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

/* ── SubContent ── */
const DropdownMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(VariantContext)
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(contentVariants({ variant }), className)}
      {...props}
    />
  )
})
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

/* ── Sub ── */
const DropdownMenuSub = DropdownMenuPrimitive.Sub

/* ── SubTrigger ── */
const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => {
  const variant = React.useContext(VariantContext)
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        'flex items-center justify-between px-3 h-[32px] mx-1.5 my-[2px] rounded-lg text-[13px] cursor-pointer select-none outline-none transition-colors duration-150',
        variant === 'glass'
          ? 'focus:bg-white/20 data-[state=open]:bg-white/20'
          : 'focus:bg-bg-active data-[state=open]:bg-bg-active',
        inset && 'pl-8',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2.5">{children}</div>
      <ChevronRight className="w-[14px] h-[14px] opacity-60" />
    </DropdownMenuPrimitive.SubTrigger>
  )
})
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

/* ── Item ── */
const DropdownMenuItem = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => {
  const variant = React.useContext(VariantContext)
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        'flex items-center justify-between px-3 h-[32px] mx-1.5 my-[2px] rounded-lg text-[13px] cursor-pointer select-none outline-none transition-colors duration-150',
        variant === 'glass'
          ? 'focus:bg-white/20'
          : 'focus:bg-bg-active',
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  )
})
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

/* ── Separator ── */
const DropdownMenuSeparator = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('h-px mx-3 my-1 bg-border/60', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

/* ── Shortcut ── */
function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('text-[11px] font-sans tracking-wide text-text-3', className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
}
