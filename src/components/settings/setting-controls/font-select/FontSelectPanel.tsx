import { Reorder } from 'framer-motion'
import { useRef } from 'react'
import { AppIcon, icons } from '../../../icons/AppIcon'
import { type FontItem, type FontSelectPanelProps } from './types'

function SelectedFontItem({ font, onToggleFont, isDraggingRef }: {
  font: FontItem
  onToggleFont: (fontId: string) => void
  isDraggingRef: React.RefObject<boolean>
}) {
  return (
    <Reorder.Item
      key={font.value}
      value={font.value}
      className="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-primary/40"
      onDragStart={() => {
        isDraggingRef.current = true
      }}
      onDragEnd={() => {
        requestAnimationFrame(() => {
          isDraggingRef.current = false
        })
      }}
      onClick={() => {
        if (!isDraggingRef.current) onToggleFont(font.value)
      }}
      whileDrag={{ scale: 1.02, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10 }}
    >
      <AppIcon icon={icons.gripVertical} size={12} className="shrink-0 cursor-grab text-text-3 active:cursor-grabbing" />
      <div className="relative flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-primary bg-primary transition-all group-hover:border-bg-card group-hover:bg-bg-card">
        <AppIcon icon={icons.check} size={11} className="text-white group-hover:text-primary" />
      </div>
      <span
        className="truncate select-none text-[12px] text-text-1 group-hover:text-white"
        style={{ fontFamily: font.family, fontWeight: font.fontWeight || 'normal' }}
      >
        {font.label}
      </span>
    </Reorder.Item>
  )
}

function UnselectedFontItem({ font, onToggleFont }: {
  font: FontItem
  onToggleFont: (fontId: string) => void
}) {
  return (
    <div
      key={font.value}
      className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-primary/40"
      onClick={() => onToggleFont(font.value)}
    >
      <div className="relative flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px] border-primary bg-transparent transition-all group-hover:border-bg-card" />
      <span
        className="truncate select-none text-[12px] text-text-1 group-hover:text-white"
        style={{ fontFamily: font.family, fontWeight: font.fontWeight || 'normal' }}
      >
        {font.label}
      </span>
    </div>
  )
}

export function FontSelectPanel({
  groups,
  inputRef,
  isAllSelected,
  isIndeterminate,
  onReorder,
  onToggleAll,
  onToggleFont,
  panelRef,
  pos,
  search,
  selectedValues,
  setSearch,
}: FontSelectPanelProps) {
  const isDraggingRef = useRef(false)

  return (
    <div
      ref={panelRef}
      className="glass-context fixed z-[1100] flex w-[280px] flex-col overflow-hidden rounded-xl"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
            <AppIcon icon={icons.search} size={12} className="text-text-3" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="??..."
            className="h-7 w-full rounded-md border border-border-subtle bg-bg-subtle/60 pl-7 pr-2 text-[11px] text-text-1 outline-none transition-all placeholder-text-3 focus:border-primary focus:bg-bg-card/80 focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <label className="flex shrink-0 cursor-pointer select-none items-center gap-1 pr-0.5 text-[11px] text-text-2 hover:text-text-1">
          <div className="relative flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-text-3 bg-transparent transition-colors dark:border-text-2">
            {isIndeterminate && !isAllSelected && <div className="h-0.5 w-2 rounded-sm bg-primary" />}
            {isAllSelected && <AppIcon icon={icons.check} size={10} className="text-primary" />}
            <input
              type="checkbox"
              className="absolute h-full w-full cursor-pointer opacity-0"
              checked={isAllSelected}
              onChange={onToggleAll}
            />
          </div>
          ??
        </label>
      </div>

      <div className="font-list-scrollbar h-[320px] overflow-y-auto p-1.5 pt-0">
        {groups.selected.length === 0 && groups.unselected.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-text-3">??????</div>
        ) : (
          <>
            {groups.selected.length > 0 && (
              <Reorder.Group axis="y" values={selectedValues} onReorder={onReorder} className="m-0 list-none p-0">
                {groups.selected.map((font) => (
                  <SelectedFontItem key={font.value} font={font} onToggleFont={onToggleFont} isDraggingRef={isDraggingRef} />
                ))}
              </Reorder.Group>
            )}
            {groups.selected.length > 0 && groups.unselected.length > 0 && (
              <div className="mx-2 my-1 border-t border-border-subtle" />
            )}
            {groups.unselected.map((font) => (
              <UnselectedFontItem key={font.value} font={font} onToggleFont={onToggleFont} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
