import { useState, useEffect, useRef } from 'react'
import { HeaderTopButton, TransferIcon, BroadcastIcon, CloudClockIcon, RegexIcon } from './HeaderIcons'
import TransferPopover from './popovers/TransferPopover'
import BroadcastPopover from './popovers/BroadcastPopover'
import HistoryPopover from './popovers/HistoryPopover'
import KeywordHighlightPanel from '../../components/settings/KeywordHighlightPanel'
import { useTransferStore } from '../../stores/useTransferStore'

export default function HeaderToolbar({ activeTabId, connectionId, assetLabel }: {
  activeTabId: string
  connectionId?: string
  assetLabel: string
}) {
  return <HeaderToolbarInner key={activeTabId} connectionId={connectionId} assetLabel={assetLabel} />
}

function HeaderToolbarInner({ connectionId, assetLabel }: { connectionId?: string; assetLabel: string }) {
  const [activePopover, setActivePopover] = useState<'transfer' | 'broadcast' | 'history' | 'highlightRules' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const activeTransferCount = useTransferStore((state) => state.tasks.filter((task) => task.status === 'active' || task.status === 'queued').length)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setActivePopover(null)
    }
    if (activePopover) window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [activePopover])

  return (
    <div className="mr-2 flex items-center gap-3.5" ref={ref} data-no-drag>
      <div className="relative">
        <HeaderTopButton icon={TransferIcon} tooltip="传输列表" isActive={activePopover === 'transfer'} onClick={() => setActivePopover((prev) => prev === 'transfer' ? null : 'transfer')} />
        {activeTransferCount > 0 && (
          <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-medium text-white">
            {activeTransferCount}
          </span>
        )}
        {activePopover === 'transfer' && <TransferPopover />}
      </div>
      <div className="relative">
        <HeaderTopButton icon={BroadcastIcon} tooltip="终端广播" isActive={activePopover === 'broadcast'} onClick={() => setActivePopover((prev) => prev === 'broadcast' ? null : 'broadcast')} />
        {activePopover === 'broadcast' && <BroadcastPopover assetName={assetLabel} />}
      </div>
      <div className="relative">
        <HeaderTopButton icon={CloudClockIcon} tooltip="历史命令" isActive={activePopover === 'history'} onClick={() => setActivePopover((prev) => prev === 'history' ? null : 'history')} />
        {activePopover === 'history' && <HistoryPopover connectionId={connectionId} />}
      </div>
      <div className="relative">
        <HeaderTopButton icon={RegexIcon} tooltip="终端关键词高亮" isActive={activePopover === 'highlightRules'} onClick={() => setActivePopover((prev) => prev === 'highlightRules' ? null : 'highlightRules')} />
        {activePopover === 'highlightRules' && (
          <div className="absolute right-0 top-full z-[250] mt-[12px] w-[380px] animate-[fade-in_0.2s_ease-out]">
            <KeywordHighlightPanel />
          </div>
        )}
      </div>
    </div>
  )
}
