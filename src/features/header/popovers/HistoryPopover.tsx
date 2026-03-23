/* ── 历史命令弹出层 ── */

import { useState, useEffect } from 'react'
import { AppIcon, icons } from '../../../components/icons/AppIcon'
import { useShortcutStore } from '../../../stores/useShortcutStore'
import * as api from '../../../api/client'

const formatLocalDateTime = (value: string | null | undefined): string => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.replace('T', ' ').replace('Z', '').slice(0, 16)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

export default function HistoryPopover({ connectionId }: { connectionId?: string }) {
  const [cmds, setCmds] = useState<{ command: string; executed_at: string }[]>([])
  const [filter, setFilter] = useState('')
  const executeShortcut = useShortcutStore((s) => s.executeShortcut)

  useEffect(() => {
    if (!connectionId) return
    api.getHistory(connectionId, 50).then(data => {
      setCmds(data.map(h => ({ command: h.command, executed_at: h.executed_at })))
    }).catch(() => {})
  }, [connectionId])

  const filtered = filter
    ? cmds.filter(c => c.command.toLowerCase().includes(filter.toLowerCase()))
    : cmds

  const handleClear = () => {
    if (!connectionId) return
    api.clearHistory(connectionId).then(() => setCmds([])).catch(() => {})
  }

  return (
    <div className="absolute right-0 top-full mt-[12px] w-[340px] bg-bg-card/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] rounded-xl border border-border z-[250] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border bg-bg-card/50">
        <div className="text-[14px] font-medium text-text-1 flex items-center gap-3">
          历史命令
          <div className="relative">
            <AppIcon icon={icons.search} size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
            <input
              type="text"
              placeholder="历史命令过滤"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-[160px] h-[26px] pl-7 pr-2 bg-bg-subtle border border-border rounded text-[12px] text-text-1 outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>
        <button
          onClick={handleClear}
          className="text-[#F53F3F] hover:bg-[#FDECE8] dark:hover:bg-[#3D2020] px-2 py-1.5 rounded text-[12px] flex items-center gap-1 transition-colors"
        >
          <AppIcon icon={icons.close} size={14} />清除
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto p-1 custom-scrollbar bg-bg-card/50">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-text-3">
            <AppIcon icon={icons.cloudFog} size={36} className="mb-2 opacity-30" />
            <span className="text-[13px]">暂无历史命令</span>
          </div>
        ) : filtered.map((cmd, i) => (
          <div
            key={i}
            className="flex flex-col group hover:bg-bg-subtle rounded-lg p-2.5 transition-colors cursor-pointer border border-transparent hover:border-border/50 mx-1 my-0.5"
            onClick={() => executeShortcut(cmd.command, 'paste')}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-[13px] text-text-1 break-all leading-snug">{cmd.command}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  className="p-1 text-text-3 hover:text-primary hover:bg-primary-bg rounded"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(cmd.command) }}
                >
                  <AppIcon icon={icons.copy} size={14} />
                </button>
              </div>
            </div>
            <span className="text-[11px] text-text-3 mt-1.5 font-mono">{formatLocalDateTime(cmd.executed_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
