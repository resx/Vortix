import { create } from 'zustand'
import * as api from '../api/client'
import { useAssetStore } from './useAssetStore'
import { useUIStore } from './useUIStore'
import { defaultAdvanced, defaultSubModals, initialState } from './ssh-config-store/defaults'
import type { AdvancedSettings, AuthType, EnvEntry, ProxyType, SshConfigState, TunnelEntry } from './ssh-config-store/types'

export type { AuthType, ProxyType, SshConfigTab, TunnelEntry, EnvEntry, AdvancedSettings, SubModalKey } from './ssh-config-store/types'

export const useSshConfigStore = create<SshConfigState>((set, get) => ({
  ...(initialState as SshConfigState),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setField: (key, value) => set({ [key]: value } as Partial<SshConfigState>),
  setAdvanced: (key, value) => set((s) => ({ advanced: { ...s.advanced, [key]: value } })),
  toggleSubModal: (key, open) => set((s) => ({ subModals: { ...s.subModals, [key]: open } })),
  setError: (key, msg) => set((s) => ({ errors: { ...s.errors, [key]: msg } })),
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
    if (s.authType === 'privateKey' && !s.privateKeyId) errors.privateKey = 'privateKey is a required field'
    if (s.authType === 'preset' && !s.presetId) errors.presetId = 'passwordPairId is a required field'
    if (s.authType === 'jump' && !s.jumpKeyId) errors.jumpKey = 'jumpPrivateKey is a required field'
    if (s.proxyType === 'SSH跳板' && !s.jumpServerId) errors.jumpServer = 'proxy.sshId is a required field'
    set({ errors })
    return Object.keys(errors).length === 0
  },

  reset: () => set({ ...(initialState as SshConfigState), advanced: { ...defaultAdvanced }, subModals: { ...defaultSubModals }, errors: {}, editingId: null, saving: false, loading: false, testing: false, testResult: null }),

  addTunnel: (tunnel) => set((s) => ({ tunnels: [...s.tunnels, tunnel] })),
  updateTunnel: (id, data) => set((s) => ({ tunnels: s.tunnels.map((t) => (t.id === id ? { ...t, ...data } : t)) })),
  removeTunnel: (id) => set((s) => ({ tunnels: s.tunnels.filter((t) => t.id !== id) })),

  addEnvVar: () => set((s) => ({ envVars: [...s.envVars, { name: `env${s.envVars.length + 1}`, value: '' }] })),
  updateEnvVar: (index, entry) => set((s) => ({ envVars: s.envVars.map((e, i) => (i === index ? { ...e, ...entry } : e)) })),
  removeEnvVar: (index) =>
    set((s) => ({
      envVars: s.envVars.filter((_, i) => i !== index),
      selectedEnvIndex: s.selectedEnvIndex === index ? null : s.selectedEnvIndex,
    })),

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
      if (isEdit) await api.updateConnection(s.editingId!, payload)
      else await api.createConnection(payload)
      await assetStore.fetchAssets()
      appStore.closeSshConfig()
      get().reset()
    } catch {
      // noop
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
      const testPayload: Record<string, unknown> = { host: s.host, port: parseInt(s.port) || 22, username: s.user }
      if (s.authType === 'preset' && s.presetId) testPayload.preset_id = s.presetId
      else if (s.authType === 'privateKey' && s.privateKeyId) {
        try {
          const keyData = await api.getSshKeyCredential(s.privateKeyId)
          testPayload.privateKey = keyData.private_key
          if (keyData.passphrase) testPayload.passphrase = keyData.passphrase
        } catch {
          testPayload.password = s.password || undefined
        }
      } else testPayload.password = s.password || undefined

      if (s.authType === 'jump' && s.jumpKeyId && !('privateKey' in testPayload)) {
        try {
          const keyData = await api.getSshKeyCredential(s.jumpKeyId)
          testPayload.privateKey = keyData.private_key
          if (keyData.passphrase) testPayload.passphrase = keyData.passphrase
        } catch {
          testPayload.password = s.password || undefined
        }
      }
      if (s.proxyType === 'SSH跳板' && s.jumpServerId) testPayload.jump_server_id = s.jumpServerId
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
      const [conn, cred] = await Promise.all([api.getConnection(id), api.getConnectionCredential(id)])
      const adv = conn.advanced && typeof conn.advanced === 'object' ? ({ ...defaultAdvanced, ...conn.advanced } as AdvancedSettings) : { ...defaultAdvanced }
      const tunnelList = Array.isArray(conn.tunnels) ? (conn.tunnels as TunnelEntry[]) : []
      const envList = Array.isArray(conn.env_vars) ? (conn.env_vars as EnvEntry[]) : []
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

      const [preset, key, jumpKey] = await Promise.all([
        conn.preset_id ? api.getPreset(conn.preset_id).catch(() => null) : null,
        conn.private_key_id ? api.getSshKey(conn.private_key_id).catch(() => null) : null,
        conn.jump_key_id ? api.getSshKey(conn.jump_key_id).catch(() => null) : null,
      ])
      set({ presetName: preset?.name ?? '', privateKeyName: key?.name ?? '', jumpKeyName: jumpKey?.name ?? '' })
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
      ...(initialState as SshConfigState),
      advanced: { ...defaultAdvanced },
      subModals: { ...defaultSubModals },
      errors: {},
      host: data.host,
      port: data.port,
      user: data.user,
      password: data.password,
      authType: data.authType === 'key' ? ('privateKey' as AuthType) : ('password' as AuthType),
      name: `${data.host}:${data.port}`,
    })
  },
}))
