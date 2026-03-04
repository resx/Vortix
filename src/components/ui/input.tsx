import * as React from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  suffix?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, suffix, ...props }, ref) => (
    <div className="relative inline-flex items-center">
      <input
        ref={ref}
        className={cn(
          'h-[32px] w-full rounded-lg border border-border bg-bg-card px-3 text-[13px] text-text-1 placeholder:text-text-disabled transition-colors',
          'focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          suffix && 'pr-9',
          className,
        )}
        {...props}
      />
      {suffix && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          {suffix}
        </div>
      )}
    </div>
  ),
)
Input.displayName = 'Input'

export { Input }
