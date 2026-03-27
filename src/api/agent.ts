import { invoke } from '@tauri-apps/api/core'

export interface AgentStatus {
  enabled: boolean
  running: boolean
  pid: number | null
  endpoint: string
  transport: string
  binaryPath: string
  lastError: string | null
}

export async function getAgentStatus(): Promise<AgentStatus> {
  return invoke<AgentStatus>('get_agent_status')
}
