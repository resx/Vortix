import { cn } from '../../../lib/utils'

interface ResizableHeaderProps {
  title: string
  width?: number
  onResize?: (width: number) => void
  tooltip?: React.ReactNode
  flex1?: boolean
  isLast?: boolean
}

export default function ResizableHeader({
  title,
  width,
  onResize,
  tooltip,
  flex1,
  isLast,
}: ResizableHeaderProps) {
  const startResize = (e: React.MouseEvent) => {
    if (!onResize || !width) return
    e.preventDefault()
    const startX = e.clientX
    const startWidth = width

    const doDrag = (dragEvent: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + dragEvent.clientX - startX)
      onResize(newWidth)
    }

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag)
      document.removeEventListener('mouseup', stopDrag)
      document.body.style.cursor = ''
    }

    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', doDrag)
    document.addEventListener('mouseup', stopDrag)
  }

  return (
    <div
      className={cn(
        'relative px-3 py-1.5 text-xs text-text-2 bg-bg-subtle flex items-center select-none',
        !isLast && 'border-r border-border',
        flex1 && 'flex-1',
      )}
      style={!flex1 && width ? { width: `${width}px`, minWidth: `${width}px` } : {}}
    >
      <span className="truncate">{title}</span>
      {tooltip && <span className="ml-1">{tooltip}</span>}
      {!isLast && (
        <div
          onMouseDown={startResize}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/30 active:bg-primary z-10"
          style={{ transform: 'translateX(50%)' }}
        />
      )}
    </div>
  )
}
