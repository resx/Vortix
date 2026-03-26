import { useRef, type ReactNode } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { AppIcon, icons } from '../../icons/AppIcon'
import { handleTitleBarDoubleClick, handleTitleBarMouseDown } from '../../../lib/window'

export default function TermThemeWorkbenchFrame({
  title,
  onClose,
  windowMode,
  children,
}: {
  title: string
  onClose: () => void
  windowMode: boolean
  children: ReactNode
}) {
  const dragControls = useDragControls()
  const constraintRef = useRef<HTMLDivElement>(null)

  if (windowMode) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-[12px] island-surface">
        <div
          className="flex h-[46px] items-center justify-between border-b border-border/60 bg-bg-card/45 px-5"
          onMouseDown={handleTitleBarMouseDown}
          onDoubleClick={handleTitleBarDoubleClick}
        >
          <span className="text-[14px] font-medium text-text-1">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="island-btn flex h-[28px] w-[28px] items-center justify-center rounded-md text-text-3 transition-colors hover:text-text-1"
          >
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={constraintRef}
      className="fixed inset-0 z-[310] flex items-center justify-center p-4 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintRef}
        dragElastic={0}
        dragMomentum={false}
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="pointer-events-auto flex h-[760px] max-h-[95vh] w-[1380px] max-w-[96vw] flex-col overflow-hidden rounded-2xl island-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex h-[46px] items-center justify-between border-b border-border/60 bg-bg-card/45 px-5 select-none"
          onPointerDown={(event) => {
            if (!(event.target as HTMLElement).closest('button')) {
              dragControls.start(event)
            }
          }}
        >
          <span className="text-[14px] font-medium text-text-1">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="island-btn flex h-[28px] w-[28px] items-center justify-center rounded-md text-text-3 transition-colors hover:text-text-1"
          >
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}
