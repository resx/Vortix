/* ── SSH 批量配置编辑弹窗（与 SshConfigDialog 同风格） ── */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import SelectKeyModal from '../ssh-config/modals/SelectKeyModal'
import SelectPresetModal from '../ssh-config/modals/SelectPresetModal'
import ManagePresetModal from '../ssh-config/modals/ManagePresetModal'
import { useUIStore } from '../../stores/useUIStore'
import { useAssetStore } from '../../stores/useAssetStore'
import { useToastStore } from '../../stores/useToastStore'
import * as api from '../../api/client'
import type { Connection } from '../../api/types'
import { getProtocolSummary } from './batch-edit-tabs'
import { AdvancedTabContent } from './batch-edit-modal/AdvancedTabContent'
import { BasicTabContent } from './batch-edit-modal/BasicTabContent'
import { EnvVarsTabContent } from './batch-edit-modal/EnvVarsTabContent'
import { ProxyTabContent } from './batch-edit-modal/ProxyTabContent'
import { defaultAdvanced, TABS, type BatchTab } from './batch-edit-modal/constants'

export default function BatchEditModal() {
  const { batchEditOpen, batchEditIds, closeBatchEdit } = useUIStore()
  const tableData = useAssetStore((s) => s.tableData)
  const fetchAssets = useAssetStore((s) => s.fetchAssets)
  const clearRowSelection = useAssetStore((s) => s.clearRowSelection)
  const { addToast } = useToastStore()

  const [connections, setConnections] = useState<Connection[]>([])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<BatchTab>('basic')

  const [keyModalFor, setKeyModalFor] = useState<'privateKey' | 'jump' | null>(null)
  const [showPresetModal, setShowPresetModal] = useState(false)
  const [managePresetId, setManagePresetId] = useState<string | null | undefined>(undefined)

  const [privateKeyName, setPrivateKeyName] = useState('')
  const [presetName, setPresetName] = useState('')
  const [jumpKeyName, setJumpKeyName] = useState('')

  const [colorTag, setColorTag] = useState<string | null>(null)
  const [environment, setEnvironment] = useState('不修改')
  const [username, setUsername] = useState('')
  const [port, setPort] = useState('')
  const [authType, setAuthType] = useState('noChange')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [privateKeyId, setPrivateKeyId] = useState('')
  const [privateKeyPassword, setPrivateKeyPassword] = useState('')
  const [showKeyPwd, setShowKeyPwd] = useState(false)
  const [mfaSecret, setMfaSecret] = useState('')
  const [presetId, setPresetId] = useState('')
  const [jumpKeyId, setJumpKeyId] = useState('')
  const [jumpKeyPassword, setJumpKeyPassword] = useState('')
  const [showJumpPwd, setShowJumpPwd] = useState(false)
  const [agentSocketPath, setAgentSocketPath] = useState('')

  const [syncProxy, setSyncProxy] = useState(false)
  const [syncEnv, setSyncEnv] = useState(false)
  const [syncAdvanced, setSyncAdvanced] = useState(false)

  const [proxyType, setProxyType] = useState('关闭')
  const [proxyHost, setProxyHost] = useState('')
  const [proxyPort, setProxyPort] = useState('1080')
  const [proxyUsername, setProxyUsername] = useState('')
  const [proxyPassword, setProxyPassword] = useState('')
  const [showProxyPwd, setShowProxyPwd] = useState(false)
  const [proxyTimeout, setProxyTimeout] = useState('10')
  const [jumpServerId, setJumpServerId] = useState<string | null>(null)

  const [envVars, setEnvVars] = useState<{ name: string; value: string }[]>([])
  const [selectedEnvIndex, setSelectedEnvIndex] = useState<number | null>(null)

  const [adv, setAdv] = useState({ ...defaultAdvanced })
  const updateAdv = useCallback(<K extends keyof typeof defaultAdvanced>(k: K, v: (typeof defaultAdvanced)[K]) => {
    setAdv((prev) => ({ ...prev, [k]: v }))
  }, [])

  const protocols = useMemo(() => batchEditIds.map((id) => tableData.find((r) => r.id === id)).filter((r) => r?.type === 'asset').map((r) => r!.protocol ?? 'ssh'), [batchEditIds, tableData])
  const summary = useMemo(() => getProtocolSummary(protocols), [protocols])
  const sshConns = useMemo(() => connections.filter((c) => c.protocol === 'ssh'), [connections])

  useEffect(() => {
    if (!batchEditOpen) return
    api.getConnections().then(setConnections).catch(() => {})
    setActiveTab('basic')
    setColorTag(null)
    setEnvironment('不修改')
    setUsername('')
    setPort('')
    setAuthType('noChange')
    setPassword('')
    setShowPwd(false)
    setPrivateKeyId('')
    setPrivateKeyPassword('')
    setShowKeyPwd(false)
    setPrivateKeyName('')
    setPresetName('')
    setJumpKeyName('')
    setMfaSecret('')
    setPresetId('')
    setJumpKeyId('')
    setJumpKeyPassword('')
    setShowJumpPwd(false)
    setAgentSocketPath('')
    setKeyModalFor(null)
    setShowPresetModal(false)
    setManagePresetId(undefined)
    setSyncProxy(false)
    setSyncEnv(false)
    setSyncAdvanced(false)
    setProxyType('关闭')
    setProxyHost('')
    setProxyPort('1080')
    setProxyUsername('')
    setProxyPassword('')
    setShowProxyPwd(false)
    setProxyTimeout('10')
    setJumpServerId(null)
    setEnvVars([])
    setSelectedEnvIndex(null)
    setAdv({ ...defaultAdvanced })
  }, [batchEditOpen])

  if (!batchEditOpen) return null

  const hasChanges = colorTag !== null || environment !== '不修改' || username.trim() !== '' || port.trim() !== '' || authType !== 'noChange' || syncProxy || syncEnv || syncAdvanced

  const handleSave = async () => {
    if (!hasChanges) return
    setSaving(true)
    try {
      const u: Record<string, unknown> = {}
      if (colorTag !== null) u.color_tag = colorTag
      if (environment !== '不修改') u.environment = environment
      if (username.trim()) u.username = username.trim()
      if (port.trim()) u.port = Number(port) || 22
      if (authType !== 'noChange') {
        u.auth_type = authType
        if (authType === 'password') u.password = password
      }
      if (syncProxy) {
        u.proxy_type = proxyType
        u.proxy_timeout = Number(proxyTimeout) || 10
        if (proxyType === 'SSH跳板') {
          u.jump_server_id = jumpServerId
        } else if (proxyType !== '关闭' && proxyType !== '自动') {
          u.proxy_host = proxyHost
          u.proxy_port = Number(proxyPort) || 1080
          u.proxy_username = proxyUsername
          u.proxy_password = proxyPassword
        }
      }
      if (syncEnv) {
        u.env_vars = JSON.stringify(envVars.filter((v) => v.name.trim()))
      }
      if (syncAdvanced) {
        u.advanced = JSON.stringify(adv)
      }

      await api.batchUpdateConnections({ ids: batchEditIds, updates: u })
      await fetchAssets()
      clearRowSelection()
      addToast('success', `已更新 ${batchEditIds.length} 条连接`)
      closeBatchEdit()
    } catch (e) {
      addToast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
      <div className="relative bg-bg-base rounded-xl shadow-xl border border-border/60 w-[700px] h-[580px] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[14px] font-bold text-text-1 tracking-wide">SSH 批量配置编辑</h2>
            <span className="text-[11px] text-text-3 bg-bg-hover px-2 py-0.5 rounded-full">{summary}</span>
          </div>
          <button onClick={closeBatchEdit} className="p-1.5 hover:bg-bg-hover rounded-md text-text-3 transition-colors">
            <AppIcon icon={icons.close} size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col mx-4 bg-bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden min-h-0">
          <div className="flex justify-center mt-4 mb-3 shrink-0">
            <div className="bg-bg-base/80 p-0.5 rounded-lg inline-flex space-x-0.5">
              {TABS.map((tab) => {
                const disabled = (tab.key === 'proxy' && !syncProxy) || (tab.key === 'env' && !syncEnv) || (tab.key === 'advanced' && !syncAdvanced)
                return (
                  <button
                    key={tab.key}
                    onClick={() => !disabled && setActiveTab(tab.key)}
                    className={`px-4 py-1.5 text-xs rounded-md transition-all ${
                      disabled
                        ? 'text-text-disabled cursor-not-allowed'
                        : activeTab === tab.key
                          ? 'bg-bg-card shadow-sm text-text-1 font-medium'
                          : 'text-text-3 hover:text-text-2'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-7 py-2 custom-scrollbar">
            {activeTab === 'basic' && <BasicTabContent colorTag={colorTag} setColorTag={setColorTag} environment={environment} setEnvironment={setEnvironment} username={username} setUsername={setUsername} port={port} setPort={setPort} authType={authType} setAuthType={setAuthType} password={password} setPassword={setPassword} showPwd={showPwd} setShowPwd={setShowPwd} privateKeyId={privateKeyId} setPrivateKeyId={setPrivateKeyId} privateKeyPassword={privateKeyPassword} setPrivateKeyPassword={setPrivateKeyPassword} showKeyPwd={showKeyPwd} setShowKeyPwd={setShowKeyPwd} privateKeyName={privateKeyName} jumpKeyName={jumpKeyName} presetName={presetName} mfaSecret={mfaSecret} setMfaSecret={setMfaSecret} presetId={presetId} setPresetId={setPresetId} jumpKeyId={jumpKeyId} setJumpKeyId={setJumpKeyId} jumpKeyPassword={jumpKeyPassword} setJumpKeyPassword={setJumpKeyPassword} showJumpPwd={showJumpPwd} setShowJumpPwd={setShowJumpPwd} agentSocketPath={agentSocketPath} setAgentSocketPath={setAgentSocketPath} syncProxy={syncProxy} setSyncProxy={setSyncProxy} syncEnv={syncEnv} setSyncEnv={setSyncEnv} syncAdvanced={syncAdvanced} setSyncAdvanced={setSyncAdvanced} proxyType={proxyType} onOpenKeyModal={setKeyModalFor} onOpenPresetModal={() => setShowPresetModal(true)} />}
            {activeTab === 'proxy' && syncProxy && (
              <ProxyTabContent proxyType={proxyType} setProxyType={setProxyType} proxyHost={proxyHost} setProxyHost={setProxyHost} proxyPort={proxyPort} setProxyPort={setProxyPort} proxyUsername={proxyUsername} setProxyUsername={setProxyUsername} proxyPassword={proxyPassword} setProxyPassword={setProxyPassword} showProxyPwd={showProxyPwd} setShowProxyPwd={setShowProxyPwd} proxyTimeout={proxyTimeout} setProxyTimeout={setProxyTimeout} jumpServerId={jumpServerId} setJumpServerId={setJumpServerId} sshConns={sshConns} />
            )}
            {activeTab === 'env' && syncEnv && <EnvVarsTabContent envVars={envVars} setEnvVars={setEnvVars} selectedIndex={selectedEnvIndex} setSelectedIndex={setSelectedEnvIndex} />}
            {activeTab === 'advanced' && syncAdvanced && <AdvancedTabContent adv={adv} updateAdv={updateAdv} />}
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end shrink-0">
          <button
            className={`text-xs font-medium transition-colors ${!hasChanges || saving ? 'text-text-disabled cursor-not-allowed' : 'text-primary hover:opacity-80'}`}
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {keyModalFor && (
        <SelectKeyModal
          onSelect={(keyId, keyName) => {
            if (keyModalFor === 'privateKey') {
              setPrivateKeyId(keyId)
              setPrivateKeyName(keyName)
            } else {
              setJumpKeyId(keyId)
              setJumpKeyName(keyName)
            }
            setKeyModalFor(null)
          }}
          onClose={() => setKeyModalFor(null)}
        />
      )}

      {showPresetModal && <SelectPresetModal onSelect={(id) => { setPresetId(id); api.getPresets().then((list) => { const p = list.find((x) => x.id === id); if (p) setPresetName(`${p.name} (${p.username})`) }).catch(() => {}); setShowPresetModal(false) }} onClose={() => setShowPresetModal(false)} onManage={(editId) => { setShowPresetModal(false); setManagePresetId(editId ?? null) }} />}

      {managePresetId !== undefined && <ManagePresetModal editId={managePresetId} onClose={() => { setManagePresetId(undefined); setShowPresetModal(true) }} onSaved={() => { setManagePresetId(undefined); setShowPresetModal(true) }} />}
    </div>
  )
}
