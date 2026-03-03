import { X, User, Clock, Globe, Monitor, HardDrive, Network, TerminalSquare } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ResponsiveContainer, LineChart as RLineChart, Line, Tooltip, YAxis } from 'recharts'
import { cn } from '../../lib/utils'

/* ---- 数据类型 ---- */
interface ServerInfo {
  user: string
  host: string
  uptime: string
  os: string
  cpuAvg: number; cpuKernel: number; cpuUser: number; cpuIo: number
  cpuTotalAvg: number; cpuTotalKernel: number; cpuTotalUser: number; cpuTotalIo: number
  cpuPerCore: number[]
  memUsed: number; memTotal: number
  swapUsed: number; swapTotal: number
  netTotalUp: string; netTotalDown: string
  netRealtimeUp: string; netRealtimeDown: string
  processes: { name: string; pid: number; cpu: string; mem: string }[]
  nics: { name: string; up: string; down: string; totalUp: string; totalDown: string; ip: string }[]
  disks: { name: string; used: number; total: number; percent: number; path: string }[]
}

interface HistoryPoint {
  time: string
  CPU: number
  内存: number
  上行: number
  下行: number
}

/* ---- 子组件 ---- */
function InfoItem({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Icon className="w-3.5 h-3.5 text-[#86909C] shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-[#86909C] leading-none">{label}</div>
        <div className="text-[11px] text-[#1F2329] font-medium truncate mt-0.5">{value}</div>
      </div>
    </div>
  )
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center py-1">
      <div className="text-[12px] text-[#1F2329] font-semibold tabular-nums">{value}</div>
      <div className="text-[9px] text-[#86909C] mt-0.5">{label}</div>
    </div>
  )
}

function MemBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const percent = total > 0 ? (used / total) * 100 : 0
  const fmtMem = (mb: number) => mb >= 1024 ? (mb / 1024).toFixed(1) + 'GB' : mb.toFixed(1) + 'MB'
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-[#86909C]">{label}</span>
      </div>
      <div className="relative h-[18px] bg-[#F2F3F5] rounded overflow-hidden">
        <div className={cn('h-full rounded transition-all duration-700', color)} style={{ width: `${percent}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white mix-blend-difference tabular-nums">
          {fmtMem(used)}/{fmtMem(total)}
        </span>
      </div>
    </div>
  )
}

function CoreBar({ index, percent }: { index: number; percent: number }) {
  const color = percent > 80 ? 'bg-[#F56C6C]' : percent > 60 ? 'bg-[#E6A23C]' : 'bg-[#4080FF]'
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[10px] text-[#1F2329] font-medium w-[36px] shrink-0">CPU{index + 1}</span>
      <div className="flex-1 h-[10px] bg-[#F2F3F5] rounded-sm overflow-hidden">
        <div className={cn('h-full rounded-sm transition-all duration-700', color)} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[10px] text-[#86909C] tabular-nums w-[36px] text-right">{percent}%</span>
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

/* ---- 主组件 ---- */
export default function ServerInfoPanel() {
  const toggleServerPanel = useAppStore((s) => s.toggleServerPanel)
  const [info, setInfo] = useState<ServerInfo | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const tickRef = useRef(0)

  useEffect(() => {
    const genPerCore = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 80 + 2))

    const genInfo = (): ServerInfo => {
      const cpuPerCore = genPerCore(2)
      const cpuAvg = +(cpuPerCore.reduce((a, b) => a + b, 0) / cpuPerCore.length).toFixed(1)
      return {
        user: 'root',
        host: '188.239.19.39:22',
        uptime: '20d 13h 10m',
        os: 'debian gnu/linux',
        cpuAvg, cpuKernel: +(Math.random() * 4 + 1).toFixed(1), cpuUser: +(Math.random() * 2).toFixed(1), cpuIo: +(Math.random() * 1).toFixed(1),
        cpuTotalAvg: +(cpuAvg + Math.random() * 3).toFixed(1), cpuTotalKernel: +(Math.random() * 6 + 2).toFixed(1), cpuTotalUser: +(Math.random() * 2).toFixed(1), cpuTotalIo: +(Math.random() * 1).toFixed(1),
        cpuPerCore,
        memUsed: Math.floor(Math.random() * 300 + 150), memTotal: 1843,
        swapUsed: 0, swapTotal: 0,
        netTotalUp: '2.7GB', netTotalDown: '2.2GB',
        netRealtimeUp: (Math.random() * 10 + 1).toFixed(1) + 'KB/s',
        netRealtimeDown: (Math.random() * 5 + 1).toFixed(1) + 'KB/s',
        processes: [
          { name: 'agent', pid: 4303, cpu: '0.4%', mem: '14.5MB' },
          { name: 'hostguard', pid: 4002, cpu: '0.1%', mem: '39.6MB' },
          { name: 'sshd', pid: 2838844, cpu: '0.1%', mem: '11.1MB' },
          { name: 'telescope', pid: 4213, cpu: '0.1%', mem: '31.9MB' },
          { name: 'uniagent', pid: 3599, cpu: '0.0%', mem: '11.3MB' },
        ],
        nics: [
          { name: 'eth0', up: '5.5K/s', down: '2.9K/s', totalUp: '2.7GB', totalDown: '2.2GB', ip: '172.31.x.x' },
          { name: 'lo', up: '0B/s', down: '0B/s', totalUp: '11MB', totalDown: '11MB', ip: '127.0.0.1' },
        ],
        disks: [
          { name: 'udev', used: 79.3, total: 879.3, percent: 9, path: '/dev' },
          { name: 'tmpfs', used: 80.7, total: 179.8, percent: 45, path: '/run' },
          { name: '/dev/vda1', used: 37.5, total: 33.96, percent: 75, path: '/' },
        ],
      }
    }

    const initHistory: HistoryPoint[] = Array.from({ length: 30 }, (_, i) => ({
      time: `${i}`,
      CPU: Math.floor(Math.random() * 40 + 2),
      内存: Math.floor(Math.random() * 20 + 10),
      上行: Math.floor(Math.random() * 30 + 5),
      下行: Math.floor(Math.random() * 15 + 2),
    }))
    setHistory(initHistory)
    tickRef.current = 30

    setInfo(genInfo())
    const timer = setInterval(() => {
      const newInfo = genInfo()
      setInfo(newInfo)
      tickRef.current++
      setHistory(prev => [
        ...prev.slice(-29),
        {
          time: `${tickRef.current}`,
          CPU: Math.floor(newInfo.cpuAvg),
          内存: Math.floor((newInfo.memUsed / newInfo.memTotal) * 100),
          上行: Math.floor(Math.random() * 30 + 5),
          下行: Math.floor(Math.random() * 15 + 2),
        },
      ])
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  if (!info) return null

  return (
    <motion.div
      id="server-info-panel"
      className="w-[380px] shrink-0 bg-white border-l border-[#E5E6EB] flex flex-col h-full shadow-[-4px_0_16px_rgba(0,0,0,0.06)]"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 380, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* 标题栏 */}
      <div className="h-[48px] flex items-center justify-between px-4 shrink-0 border-b border-[#E5E6EB]">
        <span className="text-[15px] font-bold text-[#1F2329] tracking-wide">服务器面板</span>
        <button className="p-1 rounded-md text-[#4E5969] hover:bg-[#F2F3F5] hover:text-[#1F2329] transition-colors" onClick={toggleServerPanel}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* 系统信息 */}
        <div className="px-4 pt-3 pb-2 grid grid-cols-2 gap-x-4 border-b border-[#F2F3F5]">
          <InfoItem icon={User} label="用户" value={info.user} />
          <InfoItem icon={Clock} label="运行时间" value={info.uptime} />
          <InfoItem icon={Globe} label="Host" value={info.host} />
          <InfoItem icon={Monitor} label="系统" value={info.os} />
        </div>

        {/* CPU 统计 4列 x 2行 */}
        <div className="px-4 py-2 border-b border-[#F2F3F5]">
          <div className="grid grid-cols-4 gap-1">
            <StatCell value={`${info.cpuAvg}%`} label="平均CPU占用" />
            <StatCell value={`${info.cpuKernel}%`} label="内核态" />
            <StatCell value={`${info.cpuUser}%`} label="用户态" />
            <StatCell value={`${info.cpuIo}%`} label="IO等待" />
          </div>
          <div className="grid grid-cols-4 gap-1 mt-1">
            <StatCell value={`${info.cpuTotalAvg}%`} label="总共CPU占用" />
            <StatCell value={`${info.cpuTotalKernel}%`} label="内核态" />
            <StatCell value={`${info.cpuTotalUser}%`} label="用户态" />
            <StatCell value={`${info.cpuTotalIo}%`} label="IO等待" />
          </div>
        </div>

        {/* 内存 */}
        <div className="px-4 py-2 border-b border-[#F2F3F5]">
          <MemBar label="物理内存" used={info.memUsed} total={info.memTotal} color="bg-[#4080FF]" />
          <MemBar label="Swap内存" used={info.swapUsed} total={info.swapTotal} color="bg-[#67C23A]" />
        </div>

        {/* 网络概览 */}
        <div className="px-4 py-2 border-b border-[#F2F3F5]">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className="text-[10px] text-[#86909C]">总上行</div>
              <div className="text-[11px] text-[#1F2329] font-medium">{info.netTotalUp}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#86909C]">总下行</div>
              <div className="text-[11px] text-[#1F2329] font-medium">{info.netTotalDown}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#67C23A]">实时上行</div>
              <div className="text-[11px] text-[#67C23A] font-semibold">{info.netRealtimeUp}</div>
            </div>
            <div>
              <div className="text-[10px] text-[#67C23A]">实时下行</div>
              <div className="text-[11px] text-[#67C23A] font-semibold">{info.netRealtimeDown}</div>
            </div>
          </div>
        </div>

        {/* 实时图表 */}
        <div className="px-4 py-2 border-b border-[#F2F3F5]">
          <div className="flex items-center gap-3 mb-1">
            {[
              { label: 'CPU', color: '#4080FF' },
              { label: '内存', color: '#67C23A' },
              { label: '上行', color: '#E6A23C' },
              { label: '下行', color: '#13C2C2' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-[#86909C]">{label}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={128}>
            <RLineChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <YAxis domain={[0, 100]} hide />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="CPU" stroke="#4080FF" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
              <Line type="monotone" dataKey="内存" stroke="#67C23A" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
              <Line type="monotone" dataKey="上行" stroke="#E6A23C" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
              <Line type="monotone" dataKey="下行" stroke="#13C2C2" strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={800} />
            </RLineChart>
          </ResponsiveContainer>
        </div>

        {/* CPU 核心 */}
        <div className="px-4 py-2 border-b border-[#F2F3F5]">
          {info.cpuPerCore.map((usage, i) => (
            <CoreBar key={i} index={i} percent={usage} />
          ))}
        </div>

        {/* 进程列表 */}
        <div className="px-4 py-2 border-b border-[#F2F3F5]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#1F2329]">进程列表</span>
            <span className="text-[10px] text-[#86909C] bg-[#F2F3F5] rounded px-1.5 py-0.5">{info.processes.length}</span>
          </div>
          <div className="space-y-1">
            {info.processes.map((p) => (
              <div key={p.pid} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#F7F8FA] hover:bg-[#F2F3F5] transition-colors text-[10px]">
                <TerminalSquare className="w-3.5 h-3.5 text-[#4E5969] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[#1F2329] font-medium truncate block">{p.name}</span>
                  <span className="text-[#86909C] tabular-nums">PID {p.pid}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-[#4080FF] font-semibold tabular-nums">{p.cpu}</div>
                    <div className="text-[9px] text-[#86909C]">CPU</div>
                  </div>
                  <div className="w-px h-5 bg-[#E5E6EB]" />
                  <div className="text-right">
                    <div className="text-[#67C23A] font-semibold tabular-nums">{p.mem}</div>
                    <div className="text-[9px] text-[#86909C]">内存</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 网卡信息 */}
        <div className="px-4 py-2 border-b border-[#F2F3F5]">
          <span className="text-[11px] font-medium text-[#1F2329] block mb-2">网卡信息</span>
          <div className="space-y-2">
            {info.nics.map((nic) => (
              <div key={nic.name} className="rounded-lg bg-[#F7F8FA] px-3 py-2 text-[10px]">
                {/* 网卡名 + IP */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-[#4080FF]" />
                    <span className="text-[#1F2329] font-semibold">{nic.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#4080FF]">
                    <Globe className="w-3 h-3" />
                    <span className="font-medium">{nic.ip}</span>
                  </div>
                </div>
                {/* 实时速率 + 总流量 */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                    <span className="text-[#C87A30] font-medium">↑ 实时</span>
                    <span className="text-[#C87A30] font-semibold tabular-nums">{nic.up}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                    <span className="text-[#86909C]">↑ 总计</span>
                    <span className="text-[#1F2329] font-medium tabular-nums">{nic.totalUp}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                    <span className="text-[#3D8B4F] font-medium">↓ 实时</span>
                    <span className="text-[#3D8B4F] font-semibold tabular-nums">{nic.down}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded px-2 py-1">
                    <span className="text-[#86909C]">↓ 总计</span>
                    <span className="text-[#1F2329] font-medium tabular-nums">{nic.totalDown}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 磁盘挂载 */}
        <div className="px-4 py-2">
          <span className="text-[11px] font-medium text-[#1F2329] block mb-2">磁盘挂载</span>
          <div className="space-y-2">
            {info.disks.map((d) => {
              const barColor = d.percent > 80 ? 'bg-[#F56C6C]' : d.percent > 60 ? 'bg-[#E6A23C]' : 'bg-[#4080FF]'
              const textColor = d.percent > 80 ? 'text-[#F56C6C]' : d.percent > 60 ? 'text-[#E6A23C]' : 'text-[#4080FF]'
              return (
                <div key={d.path} className="rounded-lg bg-[#F7F8FA] px-3 py-2 text-[10px]">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-[#E6A23C]" />
                      <span className="text-[#1F2329] font-semibold">{d.name}</span>
                    </div>
                    <span className={cn('font-bold tabular-nums', textColor)}>{d.percent}%</span>
                  </div>
                  <div className="relative h-[6px] bg-[#E5E6EB] rounded-full overflow-hidden mb-1.5">
                    <div className={cn('h-full rounded-full transition-all duration-700', barColor)} style={{ width: `${d.percent}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[#86909C]">
                    <span>{d.used}MB / {d.total}GB</span>
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
