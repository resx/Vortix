import type { DropZone } from '../../../types/workspace'

export function DropOverlay({ zone }: { zone: DropZone | null }) {
  if (!zone || zone === 'center') return null
  const posMap: Record<string, string> = {
    left: 'left-0 top-0 w-1/2 h-full',
    right: 'right-0 top-0 w-1/2 h-full',
    top: 'left-0 top-0 w-full h-1/2',
    bottom: 'left-0 bottom-0 w-full h-1/2',
  }
  return (
    <div className={`absolute ${posMap[zone]} bg-primary/20 backdrop-blur-[2px] border-2 border-primary/40 rounded-md z-20 pointer-events-none transition-all duration-150`} />
  )
}
