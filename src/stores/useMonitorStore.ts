/* ── 服务器监控数据 Store ── */

import { create } from 'zustand'

export interface MonitorSnapshot {
  cpuCores: number
  cpuUsage: number
  cpuKernel: number
  cpuUser: number
  cpuIo: number
  cpuPerCore: number[]
  memUsed: number
  memTotal: number
  swapUsed: number
  swapTotal: number
  netUp: number
  netDown: number
  netTotalUp: number
  netTotalDown: number
  processes: { name: string; pid: number; cpu: string; mem: string }[]
  nics: { name: string; ip: string; rxRate: number; txRate: number; rxTotal: number; txTotal: number }[]
  disks: { name: string; used: number; total: number; percent: number; path: string }[]
}

export interface SystemInfo {
  user: string
  host: string
  uptime: string
  os: string
}

export interface HistoryPoint {
  time: string
  CPU: number
  内存: number
  上行: number
  下行: number
}

interface MonitorState {
  snapshots: Record<string, MonitorSnapshot | null>
  sysInfo: Record<string, SystemInfo | null>
  history: Record<string, HistoryPoint[]>
  /** 内部计数器，用于历史点 time 标签 */
  _ticks: Record<string, number>
  updateSnapshot: (tabId: string, data: MonitorSnapshot) => void
  updateSysInfo: (tabId: string, info: SystemInfo) => void
  clearTab: (tabId: string) => void
}

export const useMonitorStore = create<MonitorState>((set) => ({
  snapshots: {},
  sysInfo: {},
  history: {},
  _ticks: {},

  updateSnapshot: (tabId, data) => set((s) => {
    const tick = (s._ticks[tabId] ?? 0) + 1
    const prev = s.history[tabId] ?? []
    const memPercent = data.memTotal > 0 ? Math.floor((data.memUsed / data.memTotal) * 100) : 0
    const point: HistoryPoint = {
      time: `${tick}`,
      CPU: Math.floor(data.cpuUsage),
      内存: memPercent,
      上行: Math.floor(data.netUp),
      下行: Math.floor(data.netDown),
    }
    return {
      snapshots: { ...s.snapshots, [tabId]: data },
      history: { ...s.history, [tabId]: [...prev.slice(-29), point] },
      _ticks: { ...s._ticks, [tabId]: tick },
    }
  }),

  updateSysInfo: (tabId, info) => set((s) => ({
    sysInfo: { ...s.sysInfo, [tabId]: info },
  })),

  clearTab: (tabId) => set((s) => {
    const snapshots = { ...s.snapshots }
    const sysInfo = { ...s.sysInfo }
    const history = { ...s.history }
    const _ticks = { ...s._ticks }
    delete snapshots[tabId]
    delete sysInfo[tabId]
    delete history[tabId]
    delete _ticks[tabId]
    return { snapshots, sysInfo, history, _ticks }
  }),
}))
