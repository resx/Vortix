import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface IslandModalProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: string
  height?: string
  padding?: string
}

export default function IslandModal({
  title,
  isOpen,
  onClose,
  children,
  footer,
  width = 'max-w-2xl',
  height,
  padding = 'px-5 py-4',
}: IslandModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
      <div
        className={cn(
          'bg-bg-base rounded-xl shadow-2xl border border-border/60 w-full flex flex-col overflow-hidden',
          'animate-in fade-in zoom-in duration-200',
          width,
        )}
        style={height ? { height } : { maxHeight: '90vh' }}
      >
        {/* 外层头部 */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0">
          <h3 className="text-[14px] font-bold text-text-1 tracking-wide">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-bg-hover rounded-md text-text-3 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 白色岛屿区 */}
        <div className="flex-1 flex flex-col mx-4 bg-bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden min-h-0">
          <div className={cn('flex-1 overflow-y-auto custom-scrollbar', padding)}>
            {children}
          </div>
        </div>

        {/* 外层底部 */}
        {footer ? (
          <div className="px-5 py-3.5 flex items-center justify-between shrink-0">
            {footer}
          </div>
        ) : (
          <div className="h-3.5 shrink-0" />
        )}
      </div>
    </div>
  )
}
