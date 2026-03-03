import { TerminalSquare, FolderOpen } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/useAppStore'

interface Props {
  connected: boolean
}

interface MonitorData {
  cpuCores: number
  netUp: number
  netDown: number
  cpuUsage: number
  memUsed: number
  diskUsed: number
}

function fmtNet(kb: number): string {
  if (kb >= 1024) return (kb / 1024).toFixed(1) + 'M'
  return kb.toFixed(0) + 'K'
}

function fmtDisk(gb: number): string {
  if (gb >= 1024) return (gb / 1024).toFixed(1) + 'T'
  return gb.toFixed(1) + 'G'
}

/* Liquid Glass 横向徽章 */
function HBadge({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      <span className="text-[8px] text-[#86909C] leading-none">{label}</span>
      <div
        className="relative rounded-md w-[36px] h-[20px] flex items-center justify-center overflow-hidden isolate"
        style={{
          background: `linear-gradient(135deg, ${tint}50, ${tint}35)`,
          border: `1px solid ${tint}40`,
          boxShadow: `inset 0 1px 4px ${tint}25, inset 0 -1px 2px rgba(0,0,0,0.05), 0 1px 3px ${tint}20`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {/* 高光层 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.05) 100%)',
            borderRadius: 'inherit',
          }}
        />
        <span className="relative text-[9px] text-white font-bold leading-none tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">{value}</span>
      </div>
    </div>
  )
}

/* Liquid Glass 纵向进度条 */
function VBar({ label, display, percent, tint }: {
  label: string; display: string; percent: number; tint: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      <span className="text-[8px] text-[#86909C] leading-none">{label}</span>
      <div
        className="relative w-[36px] h-[42px] rounded-md overflow-hidden isolate"
        style={{
          background: `linear-gradient(180deg, ${tint}18, ${tint}10)`,
          border: `1px solid ${tint}30`,
          boxShadow: `inset 0 1px 6px ${tint}15, 0 1px 4px ${tint}10`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {/* 填充层 */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out"
          style={{
            height: `${percent}%`,
            background: `linear-gradient(180deg, ${tint}70, ${tint}50)`,
          }}
        />
        {/* 高光层 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 50%)',
            borderRadius: 'inherit',
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] font-bold leading-none tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">{display}</span>
        </div>
      </div>
    </div>
  )
}

export default function ServerMonitor({ connected }: Props) {
  const toggleServerPanel = useAppStore((s) => s.toggleServerPanel)
  const toggleSftp = useAppStore((s) => s.toggleSftp)
  const [data, setData] = useState<MonitorData | null>(null)

  useEffect(() => {
    if (!connected) { setData(null); return }

    const genData = (): MonitorData => ({
      cpuCores: 4,
      netUp: Math.random() * 800 + 10,
      netDown: Math.random() * 2000 + 50,
      cpuUsage: Math.floor(Math.random() * 60 + 5),
      memUsed: +(Math.random() * 4 + 2).toFixed(1),
      diskUsed: +(Math.random() * 30 + 40).toFixed(1),
    })

    setData(genData())
    const timer = setInterval(() => setData(genData()), 3000)
    return () => clearInterval(timer)
  }, [connected])

  if (!connected || !data) {
    return (
      <div id="server-monitor" className="w-[48px] shrink-0 flex flex-col items-center justify-center">
        <span className="text-[9px] text-[#C9CDD4]">未连接</span>
      </div>
    )
  }

  const memPercent = Math.floor((data.memUsed / 8) * 100)
  const diskPercent = Math.floor((data.diskUsed / 100) * 100)

  return (
    <div id="server-monitor" className="w-[48px] shrink-0 flex flex-col items-center py-2 gap-2 overflow-y-auto custom-scrollbar">
      {/* 操作按钮 */}
      <button
        className="p-1.5 rounded-md text-[#4E5969] hover:bg-white/40 hover:text-[#1F2329] transition-colors"
        onClick={toggleServerPanel}
      >
        <TerminalSquare className="w-3.5 h-3.5" />
      </button>

      <button
        className="p-1.5 rounded-md text-[#4E5969] hover:bg-white/40 hover:text-[#1F2329] transition-colors"
        onClick={toggleSftp}
      >
        <FolderOpen className="w-3.5 h-3.5" />
      </button>

      <div className="w-6 h-px bg-[#E5E6EB]" />

      {/* Liquid Glass 徽章 */}
      <HBadge label="CPU" value={`${data.cpuCores}`} tint="#4080FF" />
      <HBadge label="上行" value={fmtNet(data.netUp)} tint="#D4883A" />
      <HBadge label="下行" value={fmtNet(data.netDown)} tint="#52B060" />

      <div className="w-6 h-px bg-[#E5E6EB]" />

      {/* Liquid Glass 进度条 */}
      <VBar label="CPU" display={`${data.cpuUsage}%`} percent={data.cpuUsage} tint="#52C41A" />
      <VBar label="内存" display={fmtDisk(data.memUsed)} percent={memPercent} tint="#4080FF" />
      <VBar label="磁盘" display={fmtDisk(data.diskUsed)} percent={diskPercent} tint="#13C2C2" />
    </div>
  )
}
