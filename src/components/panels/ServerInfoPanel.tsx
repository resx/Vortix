import { X, User, Clock, Globe, Monitor, HardDrive, Network, TerminalSquare } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useMonitorStore } from '../../stores/useMonitorStore'
import type { MonitorSnapshot, SystemInfo, HistoryPoint } from '../../stores/useMonitorStore'
import { motion } from 'framer-motion'
import { ResponsiveContainer, LineChart as RLineChart, Line, Tooltip, YAxis } from 'recharts'
import { cn } from '../../lib/utils'

/* ---- 子组件 ---- */
function InfoItem({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Icon className="w-3.5 h-3.5 text-text-3 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-text-3 leading-none">{label}</div>
        <div className="text-[11px] text-text-1 font-medium truncate mt-0.5">{value}</div>
      </div>
    </div>
  )
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center py-1">
      <div className="text-[12px] text-text-1 font-semibold tabular-nums">{value}</div>
      <div className="text-[9px] text-text-3 mt-0.5">{label}</div>
    </div>
  )
}

function MemBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const percent = total > 0 ? (used / total) * 100 : 0
  const fmtMem = (mb: number) => mb >= 1024 ? (mb / 1024).toFixed(1) + 'GB' : mb.toFixed(1) + 'MB'
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-text-3">{label}</span>
      </div>
      <div className="relative h-[18px] bg-bg-base rounded overflow-hidden">
        <div className={cn('h-full rounded transition-all duration-700', color)} style={{ width: `${percent}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white mix-blend-difference tabular-nums">
          {fmtMem(used)}/{fmtMem(total)}
        </span>
      </div>
    </div>
  )
}

function CoreBar({ index, percent }: { index: number; percent: number }) {
  const color = percent > 80 ? 'bg-status-danger' : percent > 60 ? 'bg-status-warning' : 'bg-primary'
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[10px] text-text-1 font-medium w-[36px] shrink-0">CPU{index + 1}</span>
      <div className="flex-1 h-[10px] bg-bg-base rounded-sm overflow-hidden">
        <div className={cn('h-full rounded-sm transition-all duration-700', color)} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[10px] text-text-3 tabular-nums w-[36px] text-right">{percent}%</span>
    </div>
  )
}

/* 自定义深色 Tooltip - recharts */
function ChartTooltip({ payload, active }: { payload?: Array<{ name: string; value: number; color: string }>; active?: boolean }) {
  if (!active || !payload?.length) return null
  const unitMap: Record<string, string> = { CPU: '%', 内存: '%', 上行: 'KB/s', 下行: 'KB/s' }
  return (
    <div className="bg-[#1F2329] rounded-lg px-3 py-2 shadow-xl border border-white/10">
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-[11px] text-white/70 min-w-[28px]">{item.name}</span>
          <span className="text-[11px] text-white font-medium tabular-nums">{item.value}{unitMap[item.name] || ''}</span>
        </div>
      ))}
    </div>
  )
}

/* 格式化字节为可读字符串 */
function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + 'GB'
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return bytes + 'B'
}

/* ---- 主组件 ---- */
export default function ServerInfoPanel() {
  const toggleServerPanel = useAppStore((s) => s.toggleServerPanel)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const snapshot = useMonitorStore((s) => s.snapshots[activeTabId])
  const sysInfo = useMonitorStore((s) => s.sysInfo[activeTabId])
  const history = useMonitorStore((s) => s.history[activeTabId] ?? [])

  if (!snapshot || !sysInfo) {
    return (
      <motion.div
        id="server-info-panel"
        className="w-[380px] shrink-0 bg-bg-card border-l border-border flex flex-col h-full shadow-[-4px_0_16px_rgba(0,0,0,0.06)]"
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 380, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div className="h-[48px] flex items-center justify-between px-4 shrink-0 border-b border-border">
          <span className="text-[15px] font-bold text-text-1 tracking-wide">服务器面板</span>
          <button className="p-1 rounded-md text-text-2 hover:bg-bg-hover hover:text-text-1 transition-colors" onClick={toggleServerPanel}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[12px] text-text-3">数据采集中...</span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      id="server-info-panel"
      className="w-[380px] shrink-0 bg-bg-card border-l border-border flex flex-col h-full shadow-[-4px_0_16px_rgba(0,0,0,0.06)]"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 380, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* 标题栏 */}
      <div className="h-[48px] flex items-center justify-between px-4 shrink-0 border-b border-border">
        <span className="text-[15px] font-bold text-text-1 tracking-wide">服务器面板</span>
        <button className="p-1 rounded-md text-text-2 hover:bg-bg-hover hover:text-text-1 transition-colors" onClick={toggleServerPanel}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* 系统信息 */}
        <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-x-4 border-b border-bg-base">
          <InfoItem icon={User} label="用户" value={sysInfo.user} />
          <InfoItem icon={Clock} label="运行时间" value={sysInfo.uptime} />
          <InfoItem icon={Globe} label="Host" value={sysInfo.host} />
          <InfoItem icon={Monitor} label="系统" value={sysInfo.os} />
        </div>

        {/* CPU 统计 4列 */}
        <div className="px-4 py-2 border-b border-bg-base">
          <div className="grid grid-cols-4 gap-1">
            <StatCell value={`${snapshot.cpuUsage}%`} label="平均CPU占用" />
            <StatCell value={`${snapshot.cpuKernel}%`} label="内核态" />
            <StatCell value={`${snapshot.cpuUser}%`} label="用户态" />
            <StatCell value={`${snapshot.cpuIo}%`} label="IO等待" />
          </div>
        </div>

        {/* 内存 */}
        <div className="px-4 py-2 border-b border-bg-base">
          <MemBar label="物理内存" used={snapshot.memUsed} total={snapshot.memTotal} color="bg-primary" />
          <MemBar label="Swap内存" used={snapshot.swapUsed} total={snapshot.swapTotal} color="bg-chart-green" />
        </div>

        {/* 网络概览 */}
        <div className="px-4 py-2 border-b border-bg-base">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className="text-[10px] text-text-3">总上行</div>
              <div className="text-[11px] text-text-1 font-medium">{fmtBytes(snapshot.netTotalUp)}</div>
            </div>
            <div>
              <div className="text-[10px] text-text-3">总下行</div>
              <div className="text-[11px] text-text-1 font-medium">{fmtBytes(snapshot.netTotalDown)}</div>
            </div>
            <div>
              <div className="text-[10px] text-chart-green">实时上行</div>
              <div className="text-[11px] text-chart-green font-semibold">{snapshot.netUp.toFixed(1)}KB/s</div>
            </div>
            <div>
              <div className="text-[10px] text-chart-green">实时下行</div>
              <div className="text-[11px] text-chart-green font-semibold">{snapshot.netDown.toFixed(1)}KB/s</div>
            </div>
          </div>
        </div>

        {/* 实时图表 */}
        <div className="px-4 py-2 border-b border-bg-base">
          <div className="flex items-center gap-3 mb-1">
            {[
              { label: 'CPU', color: 'var(--primary)' },
              { label: '内存', color: 'var(--chart-green)' },
              { label: '上行', color: 'var(--status-warning)' },
              { label: '下行', color: 'var(--chart-cyan)' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-text-3">{label}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={128}>
            <RLineChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <YAxis domain={[0, 100]} hide />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="CPU" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
              <Line type="monotone" dataKey="内存" stroke="var(--chart-green)" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
              <Line type="monotone" dataKey="上行" stroke="var(--status-warning)" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
              <Line type="monotone" dataKey="下行" stroke="var(--chart-cyan)" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
            </RLineChart>
          </ResponsiveContainer>
        </div>

        {/* CPU 核心 */}
        <div className="px-4 py-2 border-b border-bg-base">
          {snapshot.cpuPerCore.map((usage, i) => (
            <CoreBar key={i} index={i} percent={usage} />
          ))}
        </div>

        {/* 进程列表 */}
        <div className="px-4 py-2 border-b border-bg-base">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-text-1">进程列表</span>
            <span className="text-[10px] text-text-3 bg-bg-base rounded px-1.5 py-0.5">{snapshot.processes.length}</span>
          </div>
          <div className="space-y-1">
            {snapshot.processes.map((p) => (
              <div key={p.pid} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-subtle hover:bg-bg-hover transition-colors text-[10px]">
                <TerminalSquare className="w-3.5 h-3.5 text-text-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-text-1 font-medium truncate block">{p.name}</span>
                  <span className="text-text-3 tabular-nums">PID {p.pid}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-[#4080FF] font-semibold tabular-nums">{p.cpu}</div>
                    <div className="text-[9px] text-text-3">CPU</div>
                  </div>
                  <div className="w-px h-5 bg-border" />
                  <div className="text-right">
                    <div className="text-[#67C23A] font-semibold tabular-nums">{p.mem}</div>
                    <div className="text-[9px] text-text-3">内存</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 网卡信息 */}
        <div className="px-4 py-2 border-b border-bg-base">
          <span className="text-[11px] font-medium text-text-1 block mb-2">网卡信息</span>
          <div className="space-y-2">
            {snapshot.nics.map((nic) => (
              <div key={nic.name} className="rounded-lg bg-bg-subtle px-3 py-2 text-[10px]">
                {/* 网卡名 + IP */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-[#4080FF]" />
                    <span className="text-text-1 font-semibold">{nic.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#4080FF]">
                    <Globe className="w-3 h-3" />
                    <span className="font-medium">{nic.ip}</span>
                  </div>
                </div>
                {/* 实时速率 + 总流量 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between bg-bg-card rounded px-2 py-1">
                    <span className="text-[#C87A30] font-medium">↑ 实时</span>
                    <span className="text-[#C87A30] font-semibold tabular-nums">{nic.txRate.toFixed(1)}K/s</span>
                  </div>
                  <div className="flex items-center justify-between bg-bg-card rounded px-2 py-1">
                    <span className="text-text-3">↑ 总计</span>
                    <span className="text-text-1 font-medium tabular-nums">{fmtBytes(nic.txTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-bg-card rounded px-2 py-1">
                    <span className="text-[#3D8B4F] font-medium">↓ 实时</span>
                    <span className="text-[#3D8B4F] font-semibold tabular-nums">{nic.rxRate.toFixed(1)}K/s</span>
                  </div>
                  <div className="flex items-center justify-between bg-bg-card rounded px-2 py-1">
                    <span className="text-text-3">↓ 总计</span>
                    <span className="text-text-1 font-medium tabular-nums">{fmtBytes(nic.rxTotal)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 磁盘挂载 */}
        <div className="px-4 py-2">
          <span className="text-[11px] font-medium text-text-1 block mb-2">磁盘挂载</span>
          <div className="space-y-2">
            {snapshot.disks.map((d) => {
              const barColor = d.percent > 80 ? 'bg-status-danger' : d.percent > 60 ? 'bg-status-warning' : 'bg-primary'
              const textColor = d.percent > 80 ? 'text-status-danger' : d.percent > 60 ? 'text-status-warning' : 'text-primary'
              return (
                <div key={d.path} className="rounded-lg bg-bg-subtle px-3 py-2 text-[10px]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <HardDrive className={cn('w-3.5 h-3.5', textColor)} />
                      <span className="text-text-1 font-semibold">{d.name}</span>
                    </div>
                    <span className={cn('font-bold tabular-nums', textColor)}>{d.percent}%</span>
                  </div>
                  <div className="relative h-[6px] bg-border rounded-full overflow-hidden mb-1.5">
                    <div className={cn('h-full rounded-full transition-all duration-700', barColor)} style={{ width: `${d.percent}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-text-3">
                    <span>{d.used.toFixed(1)}GB / {d.total.toFixed(1)}GB</span>
                    <div className="flex items-center gap-1">
                      <HardDrive className="w-2.5 h-2.5" />
                      <span>{d.path}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </motion.div>
  )
}
