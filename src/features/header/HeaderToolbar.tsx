/* ── 连接工具栏（文件传输/广播/历史命令） ── */

import { useState, useEffect, useRef } from 'react'
import { HeaderTopButton, TransferIcon, BroadcastIcon, CloudClockIcon } from './HeaderIcons'
import TransferPopover from './popovers/TransferPopover'
import BroadcastPopover from './popovers/BroadcastPopover'
import HistoryPopover from './popovers/HistoryPopover'
import { useTransferStore } from '../../stores/useTransferStore'

export default function HeaderToolbar({ activeTabId, connectionId, assetLabel }: {
  activeTabId: string
  connectionId?: string
  assetLabel: string
}) {
  return <HeaderToolbarInner key={activeTabId} connectionId={connectionId} assetLabel={assetLabel} />
}

function HeaderToolbarInner({ connectionId, assetLabel }: { connectionId?: string; assetLabel: string }) {
  const [activePopover, setActivePopover] = useState<'transfer' | 'broadcast' | 'history' | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const activeTransferCount = useTransferStore(s => s.tasks.filter(t => t.status === 'active' || t.status === 'queued').length)

  // 点击外部关闭弹出层
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setActivePopover(null)
    }
    if (activePopover) window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [activePopover])

  return (
    <div className="flex items-center gap-3.5 mr-2" ref={ref}>
      <div className="relative">
        <HeaderTopButton icon={TransferIcon} tooltip="文件传输" isActive={activePopover === 'transfer'} onClick={() => setActivePopover(prev => prev === 'transfer' ? null : 'transfer')} />
        {activeTransferCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-primary text-[9px] text-white font-medium px-0.5 pointer-events-none">
            {activeTransferCount}
          </span>
        )}
        {activePopover === 'transfer' && <TransferPopover />}
      </div>
      <div className="relative">
        <HeaderTopButton icon={BroadcastIcon} tooltip="命令输入广播" isActive={activePopover === 'broadcast'} onClick={() => setActivePopover(prev => prev === 'broadcast' ? null : 'broadcast')} />
        {activePopover === 'broadcast' && <BroadcastPopover assetName={assetLabel} />}
      </div>
      <div className="relative">
        <HeaderTopButton icon={CloudClockIcon} tooltip="历史命令" isActive={activePopover === 'history'} onClick={() => setActivePopover(prev => prev === 'history' ? null : 'history')} />
        {activePopover === 'history' && <HistoryPopover connectionId={connectionId} />}
      </div>
    </div>
  )
}
