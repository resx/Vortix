import { TerminalSquare } from 'lucide-react'
import { useState, useEffect } from 'react'

interface Props {
  connected: boolean
}

interface MonitorData {
  cpuCores: number
  netUp: string
  netDown: string
  cpuUsage: number
  memUsage: number
  diskUsage: number
}

function Separator() {
  return <div className="w-full flex justify-center text-[#C9CDD4] text-[10px] leading-none select-none">-</div>
}

function MonitorItem({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-[#86909C] leading-none">{label}</span>
      <span className="text-[12px] text-[#1F2329] font-medium leading-none">
        {value}{unit && <span className="text-[10px] text-[#86909C] ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}

export default function ServerMonitor({ connected }: Props) {
  const [data, setData] = useState<MonitorData | null>(null)

  // 模拟监控数据
  useEffect(() => {
    if (!connected) { setData(null); return }

    const genData = (): MonitorData => ({
      cpuCores: 4,
      netUp: (Math.random() * 50 + 1).toFixed(1),
      netDown: (Math.random() * 200 + 10).toFixed(1),
      cpuUsage: Math.floor(Math.random() * 60 + 5),
      memUsage: Math.floor(Math.random() * 40 + 30),
      diskUsage: Math.floor(Math.random() * 30 + 40),
    })

    setData(genData())
    const timer = setInterval(() => setData(genData()), 3000)
    return () => clearInterval(timer)
  }, [connected])

  if (!connected || !data) {
    return (
      <div id="server-monitor" className="w-[80px] shrink-0 border-l border-[#E5E6EB] flex flex-col items-center justify-center">
        <span className="text-[10px] text-[#C9CDD4]">未连接</span>
      </div>
    )
  }

  return (
    <div id="server-monitor" className="w-[80px] shrink-0 border-l border-[#E5E6EB] flex flex-col items-center py-3 gap-2 overflow-y-auto custom-scrollbar">
      {/* 服务器信息按钮 */}
      <button className="p-1.5 rounded-md text-[#4E5969] hover:bg-[#F2F3F5] hover:text-[#1F2329] transition-colors">
        <TerminalSquare className="w-4 h-4" />
      </button>

      <Separator />

      <MonitorItem label="CPU核心" value={data.cpuCores} unit="核" />

      <Separator />

      <MonitorItem label="网络↑" value={data.netUp} unit="KB/s" />

      <Separator />

      <MonitorItem label="网络↓" value={data.netDown} unit="KB/s" />

      <Separator />

      <MonitorItem label="CPU" value={data.cpuUsage} unit="%" />

      <Separator />

      <MonitorItem label="内存" value={data.memUsage} unit="%" />

      <Separator />

      <MonitorItem label="磁盘" value={data.diskUsage} unit="%" />
    </div>
  )
}
