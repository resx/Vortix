import type { MutableRefObject } from 'react'
import { useMonitorStore } from '../../../stores/useMonitorStore'
import type { MonitorSnapshot, SystemInfo } from '../../../stores/useMonitorStore'
import type { TerminalSocketLike } from '../../../stores/terminalSessionRegistry'

interface MonitorRuntimeOptions {
  enabled: boolean
  isLocal: boolean
  ws: TerminalSocketLike | null | undefined
  monitorRunningRef: MutableRefObject<boolean>
}

export function resetMonitorState(monitorRunningRef: MutableRefObject<boolean>): void {
  monitorRunningRef.current = false
}

export function startMonitorIfNeeded({
  enabled,
  isLocal,
  ws,
  monitorRunningRef,
}: MonitorRuntimeOptions): void {
  if (!enabled || isLocal || !ws || ws.readyState !== WebSocket.OPEN || monitorRunningRef.current) return
  ws.send(JSON.stringify({ type: 'monitor-start' }))
  monitorRunningRef.current = true
}

export function stopMonitorIfRunning({
  ws,
  monitorRunningRef,
}: Pick<MonitorRuntimeOptions, 'ws' | 'monitorRunningRef'>): void {
  if (!monitorRunningRef.current) return
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'monitor-stop' }))
  }
  monitorRunningRef.current = false
}

export function syncMonitorRuntime(options: MonitorRuntimeOptions): void {
  if (options.enabled && !options.isLocal) {
    startMonitorIfNeeded(options)
    return
  }
  stopMonitorIfRunning(options)
}

export function handleMonitorMessage(
  type: string,
  data: MonitorSnapshot | SystemInfo,
  options: {
    enabled: boolean
    tabId?: string
  },
): boolean {
  if (type === 'monitor-data') {
    if (options.enabled && options.tabId) {
      useMonitorStore.getState().updateSnapshot(options.tabId, data as MonitorSnapshot)
    }
    return true
  }

  if (type === 'monitor-info') {
    if (options.enabled && options.tabId) {
      useMonitorStore.getState().updateSysInfo(options.tabId, data as SystemInfo)
    }
    return true
  }

  return false
}
