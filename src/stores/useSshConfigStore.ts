import { create } from 'zustand'
import * as api from '../api/client'
import { useUIStore } from './useUIStore'
import { useAssetStore } from './useAssetStore'

/* ── 类型定义 ── */

export type AuthType = 'password' | 'privateKey' | 'mfa' | 'preset' | 'jump' | 'agent' | 'none'
export type ProxyType = '关闭' | '自动' | 'SOCKS5' | 'HTTP' | 'HTTPS' | 'SSH跳板'
export type SshConfigTab = '标准' | '隧道' | '代理' | '环境变量' | '高级'

export interface TunnelEntry {
  id: string
  name: string
  type: '本地' | '远程' | '本地SOCKS5' | '远程SOCKS5'
  bindIp: string
  bindPort: string
  targetIp: string
  targetPort: string
  disabled: boolean
}

export interface EnvEntry {
  name: string
  value: string
}

export interface AdvancedSettings {
  sftp: boolean
  lrzsz: boolean
  trzsz: boolean
  sftpSudo: boolean
  x11: boolean
  terminalEnhance: boolean
  pureTerminal: boolean
  recordLog: boolean
  x11Display: string
  sftpCommand: string
  heartbeat: string
  connectTimeout: string
  encoding: string
  terminalType: string
  sftpDefaultPath: string
  expireDate: string
  initCommand: string
}

export type SubModalKey =
  | 'selectKey'
  | 'importKey'
  | 'selectPreset'
  | 'managePreset'
  | 'editTunnel'
  | 'selectAsset'

interface SshConfigState {
  activeTab: SshConfigTab

  // 标准 Tab
  colorTag: string | null
  environment: string
  name: string
  host: string
  user: string
  port: string
  authType: AuthType
  password: string
  privateKeyId: string | null
  privateKeyName: string
  privateKeyPassword: string
  mfaSecret: string
  presetId: string | null
  presetName: string
  jumpKeyId: string | null
  jumpKeyName: string
  jumpKeyPassword: string
  agentSocketPath: string
  remark: string

  // 隧道 Tab
  tunnels: TunnelEntry[]
  editingTunnel: TunnelEntry | null

  // 代理 Tab
  proxyType: ProxyType
  proxyHost: string
  proxyPort: string
  proxyUsername: string
  proxyPassword: string
  proxyTimeout: string
  jumpServerId: string | null
  jumpServerName: string

  // 环境变量 Tab
  envVars: EnvEntry[]
  selectedEnvIndex: number | null

  // 高级 Tab
  advanced: AdvancedSettings

  // 子弹窗
  subModals: Record<SubModalKey, boolean>

  // 校验
  errors: Record<string, string>

  // 编辑模式
  editingId: string | null
  saving: boolean
  loading: boolean

  // 测试连接
  testing: boolean
  testResult: { success: boolean; message: string } | null

  // 操作
  setActiveTab: (tab: SshConfigTab) => void
  setField: <K extends keyof SshConfigState>(key: K, value: SshConfigState[K]) => void
  setAdvanced: <K extends keyof AdvancedSettings>(key: K, value: AdvancedSettings[K]) => void
  toggleSubModal: (key: SubModalKey, open: boolean) => void
  setError: (key: string, msg: string) => void
  clearError: (key: string) => void
  validate: () => boolean
  reset: () => void

  // 隧道操作
  addTunnel: (tunnel: TunnelEntry) => void
  updateTunnel: (id: string, tunnel: Partial<TunnelEntry>) => void
  removeTunnel: (id: string) => void

  // 环境变量操作
  addEnvVar: () => void
  updateEnvVar: (index: number, entry: Partial<EnvEntry>) => void
  removeEnvVar: (index: number) => void

  // 持久化
  save: () => Promise<void>
  loadFromConnection: (id: string) => Promise<void>
  testConnection: () => Promise<void>

  // 从快速连接预填充
  prefillFromQuickConnect: (data: { host: string; port: string; user: string; password: string; authType: 'password' | 'key' }) => void
}

const defaultAdvanced: AdvancedSettings = {
  sftp: true,
  lrzsz: true,
  trzsz: true,
  sftpSudo: false,
  x11: false,
  terminalEnhance: false,
  pureTerminal: false,
  recordLog: false,
  x11Display: 'localhost:0.0',
  sftpCommand: 'sudo -S /usr/lib/openssh/sftp-server',
  heartbeat: '0',
  connectTimeout: '15',
  encoding: 'UTF-8',
  terminalType: 'xterm-256color',
  sftpDefaultPath: '',
  expireDate: '',
  initCommand: '',
}

const defaultSubModals: Record<SubModalKey, boolean> = {
  selectKey: false,
  importKey: false,
  selectPreset: false,
  managePreset: false,
  editTunnel: false,
  selectAsset: false,
}

const initialState = {
  activeTab: '标准' as SshConfigTab,
  colorTag: null as string | null,
  environment: '无',
  name: '',
  host: '',
  user: 'root',
  port: '22',
  authType: 'password' as AuthType,
  password: '',
  privateKeyId: null as string | null,
  privateKeyName: '',
  privateKeyPassword: '',
  mfaSecret: '',
  presetId: null as string | null,
  presetName: '',
  jumpKeyId: null as string | null,
  jumpKeyName: '',
  jumpKeyPassword: '',
  agentSocketPath: '',
  remark: '',
  tunnels: [] as TunnelEntry[],
  editingTunnel: null as TunnelEntry | null,
  proxyType: '关闭' as ProxyType,
  proxyHost: '127.0.0.1',
  proxyPort: '7890',
  proxyUsername: '',
  proxyPassword: '',
  proxyTimeout: '5',
  jumpServerId: null as string | null,
  jumpServerName: '',
  envVars: [] as EnvEntry[],
  selectedEnvIndex: null as number | null,
  advanced: { ...defaultAdvanced },
  subModals: { ...defaultSubModals },
  errors: {} as Record<string, string>,
  editingId: null as string | null,
  saving: false,
  loading: false,
  testing: false,
  testResult: null as { success: boolean; message: string } | null,
}

export const useSshConfigStore = create<SshConfigState>((set, get) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setField: (key, value) => set({ [key]: value } as Partial<SshConfigState>),

  setAdvanced: (key, value) =>
    set((s) => ({ advanced: { ...s.advanced, [key]: value } })),

  toggleSubModal: (key, open) =>
    set((s) => ({ subModals: { ...s.subModals, [key]: open } })),

  setError: (key, msg) =>
    set((s) => ({ errors: { ...s.errors, [key]: msg } })),

  clearError: (key) =>
    set((s) => {
      const next = { ...s.errors }
      delete next[key]
      return { errors: next }
    }),

  validate: () => {
    const s = get()
    const errors: Record<string, string> = {}
    if (!s.name.trim()) errors.name = 'name is a required field'
    if (!s.host.trim()) errors.host = 'host is a required field'
    if (s.authType === 'privateKey' && !s.privateKeyId)
      errors.privateKey = 'privateKey is a required field'
    if (s.authType === 'preset' && !s.presetId)
      errors.presetId = 'passwordPairId is a required field'
    if (s.authType === 'jump' && !s.jumpKeyId)
      errors.jumpKey = 'jumpPrivateKey is a required field'
    if (s.proxyType === 'SSH跳板' && !s.jumpServerId)
      errors.jumpServer = 'proxy.sshId is a required field'
    set({ errors })
    return Object.keys(errors).length === 0
  },

  reset: () => set({ ...initialState, advanced: { ...defaultAdvanced }, subModals: { ...defaultSubModals }, errors: {}, editingId: null, saving: false, loading: false, testing: false, testResult: null }),

  // 隧道
  addTunnel: (tunnel) => set((s) => ({ tunnels: [...s.tunnels, tunnel] })),
  updateTunnel: (id, data) =>
    set((s) => ({ tunnels: s.tunnels.map((t) => (t.id === id ? { ...t, ...data } : t)) })),
  removeTunnel: (id) => set((s) => ({ tunnels: s.tunnels.filter((t) => t.id !== id) })),

  // 环境变量
  addEnvVar: () =>
    set((s) => ({ envVars: [...s.envVars, { name: `env${s.envVars.length + 1}`, value: '' }] })),
  updateEnvVar: (index, entry) =>
    set((s) => ({ envVars: s.envVars.map((e, i) => (i === index ? { ...e, ...entry } : e)) })),
  removeEnvVar: (index) =>
    set((s) => ({
      envVars: s.envVars.filter((_, i) => i !== index),
      selectedEnvIndex: s.selectedEnvIndex === index ? null : s.selectedEnvIndex,
    })),

  // 持久化
  save: async () => {
    const s = get()
    if (!s.validate()) return
    set({ saving: true })
    try {
      const appStore = useUIStore.getState()
      const assetStore = useAssetStore.getState()
      const isEdit = appStore.sshConfigMode === 'edit' && !!s.editingId

      const payload = {
        name: s.name,
        host: s.host,
        port: parseInt(s.port) || 22,
        username: s.user,
        password: s.password || undefined,
        remark: s.remark,
        color_tag: s.colorTag,
        environment: s.environment,
        auth_type: s.authType,
        preset_id: s.authType === 'preset' ? s.presetId : null,
        private_key_id: s.authType === 'privateKey' ? s.privateKeyId : null,
        jump_key_id: s.authType === 'jump' ? s.jumpKeyId : null,
        proxy_type: s.proxyType,
        proxy_host: s.proxyHost,
        proxy_port: parseInt(s.proxyPort) || 7890,
        proxy_username: s.proxyUsername,
        proxy_password: s.proxyPassword || undefined,
        proxy_timeout: parseInt(s.proxyTimeout) || 5,
        jump_server_id: s.jumpServerId,
        tunnels: JSON.stringify(s.tunnels),
        env_vars: JSON.stringify(s.envVars),
        advanced: JSON.stringify(s.advanced),
        folder_id: assetStore.currentFolder,
      }

      if (isEdit) {
        await api.updateConnection(s.editingId!, payload)
      } else {
        await api.createConnection(payload)
      }

      await assetStore.fetchAssets()
      appStore.closeSshConfig()
      get().reset()
    } catch {
      // 静默处理
    } finally {
      set({ saving: false })
    }
  },

  testConnection: async () => {
    const s = get()
    if (!s.host.trim() || !s.user.trim()) {
      set({ testResult: { success: false, message: '请填写主机和用户名' } })
      return
    }
    set({ testing: true, testResult: null })
    try {
      const testPayload: Record<string, unknown> = {
        host: s.host,
        port: parseInt(s.port) || 22,
        username: s.user,
      }

      if (s.authType === 'preset' && s.presetId) {
        testPayload.preset_id = s.presetId
      } else if (s.authType === 'privateKey' && s.privateKeyId) {
        // 从密钥库获取私钥用于测试
        try {
          const keyData = await api.getSshKeyCredential(s.privateKeyId)
          testPayload.privateKey = keyData.private_key
          if (keyData.passphrase) testPayload.passphrase = keyData.passphrase
        } catch {
          testPayload.password = s.password || undefined
        }
      } else {
        testPayload.password = s.password || undefined
      }

      if (s.authType === 'jump' && s.jumpKeyId && !('privateKey' in testPayload)) {
        try {
          const keyData = await api.getSshKeyCredential(s.jumpKeyId)
          testPayload.privateKey = keyData.private_key
          if (keyData.passphrase) testPayload.passphrase = keyData.passphrase
        } catch {
          testPayload.password = s.password || undefined
        }
      }

      if (s.proxyType === 'SSH跳板' && s.jumpServerId) {
        testPayload.jump_server_id = s.jumpServerId
      }

      const result = await api.testSshConnection(testPayload)
      set({ testResult: { success: result.success, message: result.message || result.error || '' } })
    } catch (e) {
      set({ testResult: { success: false, message: (e as Error).message } })
    } finally {
      set({ testing: false })
    }
  },

  loadFromConnection: async (id) => {
    set({ loading: true })
    try {
      const [conn, cred] = await Promise.all([
        api.getConnection(id),
        api.getConnectionCredential(id),
      ])

      const adv = (conn.advanced && typeof conn.advanced === 'object')
        ? { ...defaultAdvanced, ...conn.advanced } as AdvancedSettings
        : { ...defaultAdvanced }

      const tunnelList = Array.isArray(conn.tunnels) ? conn.tunnels as TunnelEntry[] : []
      const envList = Array.isArray(conn.env_vars) ? conn.env_vars as EnvEntry[] : []

      set({
        editingId: id,
        name: conn.name,
        host: conn.host,
        port: String(conn.port),
        user: conn.username,
        password: cred.password ?? '',
        remark: conn.remark ?? '',
        colorTag: conn.color_tag,
        environment: conn.environment ?? '无',
        authType: (conn.auth_type ?? 'password') as AuthType,
        presetId: conn.preset_id ?? null,
        privateKeyId: conn.private_key_id ?? null,
        jumpKeyId: conn.jump_key_id ?? null,
        proxyType: (conn.proxy_type ?? '关闭') as ProxyType,
        proxyHost: conn.proxy_host ?? '127.0.0.1',
        proxyPort: String(conn.proxy_port ?? 7890),
        proxyUsername: conn.proxy_username ?? '',
        proxyPassword: cred.proxy_password ?? '',
        proxyTimeout: String(conn.proxy_timeout ?? 5),
        jumpServerId: conn.jump_server_id,
        tunnels: tunnelList,
        envVars: envList,
        advanced: adv,
        loading: false,
      })

      // 并发解析引用的显示名称
      const [preset, key, jumpKey] = await Promise.all([
        conn.preset_id ? api.getPreset(conn.preset_id).catch(() => null) : null,
        conn.private_key_id ? api.getSshKey(conn.private_key_id).catch(() => null) : null,
        conn.jump_key_id ? api.getSshKey(conn.jump_key_id).catch(() => null) : null,
      ])
      set({
        presetName: preset?.name ?? '',
        privateKeyName: key?.name ?? '',
        jumpKeyName: jumpKey?.name ?? '',
      })
      if (conn.jump_server_id) {
        const jumpConnection = await api.getConnection(conn.jump_server_id).catch(() => null)
        set({ jumpServerName: jumpConnection ? `${jumpConnection.name} (${jumpConnection.host})` : '' })
      }
    } catch {
      set({ loading: false })
    }
  },

  prefillFromQuickConnect: (data) => {
    set({
      ...initialState,
      advanced: { ...defaultAdvanced },
      subModals: { ...defaultSubModals },
      errors: {},
      host: data.host,
      port: data.port,
      user: data.user,
      password: data.password,
      authType: data.authType === 'key' ? 'privateKey' as AuthType : 'password' as AuthType,
      name: `${data.host}:${data.port}`,
    })
  },
}))
