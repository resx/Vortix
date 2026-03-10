import { AppIcon, icons } from '../icons/AppIcon'
import { useUIStore } from '../../stores/useUIStore'
import { useMonitorStore } from '../../stores/useMonitorStore'

interface Props {
  connected: boolean
  tabId: string
}

function fmtNet(kb: number | null | undefined): string {
  if (kb == null) return '0K'
  if (kb >= 1024) return (kb / 1024).toFixed(1) + 'M'
  return kb.toFixed(0) + 'K'
}

function fmtDisk(gb: number | null | undefined): string {
  if (gb == null) return '0G'
  if (gb >= 1024) return (gb / 1024).toFixed(1) + 'T'
  return gb.toFixed(1) + 'G'
}

/* Liquid Glass 横向徽章 */
function HBadge({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-full">
      <span className="text-[8px] text-text-3 leading-none">{label}</span>
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
      <span className="text-[8px] text-text-3 leading-none">{label}</span>
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

export default function ServerMonitor({ connected, tabId }: Props) {
  const toggleServerPanel = useUIStore((s) => s.toggleServerPanel)
  const toggleSftp = useUIStore((s) => s.toggleSftp)
  const snapshot = useMonitorStore((s) => s.snapshots[tabId])

  if (!connected || !snapshot) {
    return (
      <div id="server-monitor" className="w-[48px] shrink-0 flex flex-col items-center justify-center">
        <span className="text-[9px] text-text-disabled">{connected ? '采集中...' : '未连接'}</span>
      </div>
    )
  }

  const memPercent = snapshot.memTotal > 0 ? Math.floor((snapshot.memUsed / snapshot.memTotal) * 100) : 0
  const diskTotal = snapshot.disks.reduce((a, d) => a + d.total, 0)
  const diskUsed = snapshot.disks.reduce((a, d) => a + d.used, 0)
  const diskPercent = diskTotal > 0 ? Math.floor((diskUsed / diskTotal) * 100) : 0

  return (
    <div id="server-monitor" className="w-[48px] shrink-0 flex flex-col items-center py-2 gap-2 overflow-y-auto custom-scrollbar">
      {/* 操作按钮 */}
      <button
        className="p-1.5 rounded-md text-text-2 hover:bg-bg-card/40 hover:text-text-1 transition-colors"
        onClick={toggleServerPanel}
      >
        <AppIcon icon={icons.terminal} size={14} className="w-3.5 h-3.5" />
      </button>

      <button
        className="p-1.5 rounded-md text-text-2 hover:bg-bg-card/40 hover:text-text-1 transition-colors"
        onClick={toggleSftp}
      >
        <AppIcon icon={icons.folderOpen} size={14} className="w-3.5 h-3.5" />
      </button>

      <div className="w-6 h-px bg-border" />

      {/* Liquid Glass 徽章 */}
      <HBadge label="CPU" value={`${snapshot.cpuCores}`} tint="#4080FF" />
      <HBadge label="上行" value={fmtNet(snapshot.netUp)} tint="#E6A23C" />
      <HBadge label="下行" value={fmtNet(snapshot.netDown)} tint="#67C23A" />

      <div className="w-6 h-px bg-border" />

      {/* Liquid Glass 进度条 */}
      <VBar label="CPU" display={`${Math.floor(snapshot.cpuUsage)}%`} percent={snapshot.cpuUsage} tint="#67C23A" />
      <VBar label="内存" display={fmtDisk(snapshot.memUsed / 1024)} percent={memPercent} tint="#4080FF" />
      <VBar label="磁盘" display={fmtDisk(diskUsed)} percent={diskPercent} tint="#13C2C2" />
    </div>
  )
}
