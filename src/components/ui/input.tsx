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
          'h-[32px] w-full rounded-lg border border-[#E5E6EB] bg-white px-3 text-[13px] text-[#1F2329] placeholder:text-[#C9CDD4] transition-colors',
          'focus:border-[#4080FF] focus:ring-1 focus:ring-[#4080FF]/20 focus:outline-none',
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
