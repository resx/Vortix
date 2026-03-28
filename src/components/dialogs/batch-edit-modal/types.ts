import type { Connection } from '../../../api/types'
import type { defaultAdvanced } from './constants'

export type AdvancedState = typeof defaultAdvanced

export interface BasicTabProps {
  colorTag: string | null
  setColorTag: (v: string | null) => void
  environment: string
  setEnvironment: (v: string) => void
  username: string
  setUsername: (v: string) => void
  port: string
  setPort: (v: string) => void
  authType: string
  setAuthType: (v: string) => void
  password: string
  setPassword: (v: string) => void
  showPwd: boolean
  setShowPwd: (v: boolean) => void
  privateKeyId: string
  setPrivateKeyId: (v: string) => void
  privateKeyPassword: string
  setPrivateKeyPassword: (v: string) => void
  showKeyPwd: boolean
  setShowKeyPwd: (v: boolean) => void
  privateKeyName: string
  jumpKeyName: string
  presetName: string
  mfaSecret: string
  setMfaSecret: (v: string) => void
  presetId: string
  setPresetId: (v: string) => void
  jumpKeyId: string
  setJumpKeyId: (v: string) => void
  jumpKeyPassword: string
  setJumpKeyPassword: (v: string) => void
  showJumpPwd: boolean
  setShowJumpPwd: (v: boolean) => void
  agentSocketPath: string
  setAgentSocketPath: (v: string) => void
  syncProxy: boolean
  setSyncProxy: (v: boolean) => void
  syncEnv: boolean
  setSyncEnv: (v: boolean) => void
  syncAdvanced: boolean
  setSyncAdvanced: (v: boolean) => void
  proxyType: string
  onOpenKeyModal: (target: 'privateKey' | 'jump') => void
  onOpenPresetModal: () => void
}

export interface ProxyTabProps {
  proxyType: string
  setProxyType: (v: string) => void
  proxyHost: string
  setProxyHost: (v: string) => void
  proxyPort: string
  setProxyPort: (v: string) => void
  proxyUsername: string
  setProxyUsername: (v: string) => void
  proxyPassword: string
  setProxyPassword: (v: string) => void
  showProxyPwd: boolean
  setShowProxyPwd: (v: boolean) => void
  proxyTimeout: string
  setProxyTimeout: (v: string) => void
  jumpServerId: string | null
  setJumpServerId: (v: string | null) => void
  sshConns: Connection[]
}

export interface EnvVarItem {
  name: string
  value: string
}

export interface EnvTabProps {
  envVars: EnvVarItem[]
  setEnvVars: (v: EnvVarItem[]) => void
  selectedIndex: number | null
  setSelectedIndex: (v: number | null) => void
}

export interface AdvancedTabProps {
  adv: AdvancedState
  updateAdv: <K extends keyof AdvancedState>(k: K, v: AdvancedState[K]) => void
}
