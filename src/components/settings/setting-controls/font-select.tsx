import { createPortal } from 'react-dom'
import { cn } from '../../../lib/utils'
import { AppIcon, icons } from '../../icons/AppIcon'
import { SettingRow } from '../SettingGroup'
import { FontSelectPanel } from './font-select/FontSelectPanel'
import { useFontSelectState } from './font-select/useFontSelectState'
import { type SFontSelectProps } from './font-select/types'

export function SFontSelect(props: SFontSelectProps) {
  const { desc, label } = props
  const {
    displayText,
    groups,
    handleReorder,
    handleToggleAll,
    handleToggleFont,
    inputRef,
    isAllSelected,
    isIndeterminate,
    open,
    panelRef,
    pos,
    search,
    selectedValues,
    setSearch,
    toggleOpen,
    triggerRef,
  } = useFontSelectState(props)

  return (
    <SettingRow label={label} desc={desc}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="island-control inline-flex h-[26px] max-w-[200px] cursor-pointer items-center gap-1 overflow-hidden px-2 text-[12px] text-text-2 outline-none transition-colors hover:text-text-1"
        title={displayText}
      >
        <span className="truncate">{displayText}</span>
        <AppIcon icon={icons.chevronDown} size={14} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <FontSelectPanel
          panelRef={panelRef}
          inputRef={inputRef}
          pos={pos}
          search={search}
          setSearch={setSearch}
          isAllSelected={isAllSelected}
          isIndeterminate={isIndeterminate}
          onToggleAll={handleToggleAll}
          groups={groups}
          selectedValues={selectedValues}
          onReorder={handleReorder}
          onToggleFont={handleToggleFont}
        />,
        document.body,
      )}
    </SettingRow>
  )
}
