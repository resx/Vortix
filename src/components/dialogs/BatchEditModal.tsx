/* ── SSH 批量配置编辑弹窗（与 SshConfigDialog 同风格） ── */

import { useState, useEffect, useMemo, memo, useCallback } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { useUIStore } from '../../stores/useUIStore'
import { useAssetStore } from '../../stores/useAssetStore'
import { useToastStore } from '../../stores/useToastStore'
import HoverTooltip from '../ui/hover-tooltip'
import SelectKeyModal from '../ssh-config/modals/SelectKeyModal'
import SelectPresetModal from '../ssh-config/modals/SelectPresetModal'
import ManagePresetModal from '../ssh-config/modals/ManagePresetModal'
import * as api from '../../api/client'
import type { Connection } from '../../api/types'
import { getProtocolSummary } from './batch-edit-tabs'

// ── 样式常量（与 SshConfigDialog 一致） ──
const inputClass = 'w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1'
const labelClass = 'block text-xs text-text-2 mb-1.5'
const selectClass = `${inputClass} appearance-none cursor-pointer`
const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500', 'bg-cyan-500', 'bg-blue-500', 'bg-purple-500', 'bg-gray-500']
const chevronSvg = <svg className="absolute right-2.5 top-2 text-text-3 pointer-events-none w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>

type BatchTab = 'basic' | 'proxy' | 'env' | 'advanced'
const TABS: { key: BatchTab; label: string }[] = [
  { key: 'basic', label: '基础' },
  { key: 'proxy', label: '代理' },
  { key: 'env', label: '环境变量' },
  { key: 'advanced', label: '高级' },
]

const AUTH_TYPES = [
  { id: 'noChange', label: '不修改' },
  { id: 'password', label: '密码' },
  { id: 'privateKey', label: '私钥' },
  { id: 'mfa', label: 'MFA/2FA' },
  { id: 'preset', label: '预设账号密码' },
  { id: 'jump', label: '跳板机私钥' },
  { id: 'agent', label: 'SSH Agent' },
  { id: 'none', label: '不验证' },
]

const PROXY_TYPES = ['关闭', '自动', 'SOCKS5', 'HTTP', 'HTTPS', 'SSH跳板']
const ENCODINGS = ['UTF-8', 'GBK', 'GB2312', 'ASCII', 'US-ASCII', 'EUC-JP', 'EUC-KR', 'ISO-2022-JP']
const TERM_TYPES = ['xterm-256color', 'xterm', 'xterm-16color', 'vt100', 'linux']

// ── 高级设置默认值 ──
const defaultAdvanced = {
  sftp: true, lrzsz: false, trzsz: false, sftpSudo: false,
  x11: false, terminalEnhance: true, pureTerminal: false, recordLog: false,
  x11Display: 'localhost:0', sftpCommand: '', heartbeat: '30', connectTimeout: '10',
  encoding: 'UTF-8', terminalType: 'xterm-256color', sftpDefaultPath: '', expireDate: '', initCommand: '',
}
export default function BatchEditModal() {
  const { batchEditOpen, batchEditIds, closeBatchEdit } = useUIStore()
  const tableData = useAssetStore((s) => s.tableData)
  const fetchAssets = useAssetStore((s) => s.fetchAssets)
  const clearRowSelection = useAssetStore((s) => s.clearRowSelection)
  const { addToast } = useToastStore()

  const [connections, setConnections] = useState<Connection[]>([])
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<BatchTab>('basic')

  // 弹窗状态：私钥选择 / 预设选择 / 预设管理
  const [keyModalFor, setKeyModalFor] = useState<'privateKey' | 'jump' | null>(null)
  const [showPresetModal, setShowPresetModal] = useState(false)
  const [managePresetId, setManagePresetId] = useState<string | null | undefined>(undefined) // undefined=关闭, null=新建, string=编辑

  // 私钥/预设显示名称（用于 UI 展示）
  const [privateKeyName, setPrivateKeyName] = useState('')
  const [presetName, setPresetName] = useState('')
  const [jumpKeyName, setJumpKeyName] = useState('')

  // 基础 Tab
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

  // 同步开关
  const [syncProxy, setSyncProxy] = useState(false)
  const [syncEnv, setSyncEnv] = useState(false)
  const [syncAdvanced, setSyncAdvanced] = useState(false)

  // 代理 Tab
  const [proxyType, setProxyType] = useState('关闭')
  const [proxyHost, setProxyHost] = useState('')
  const [proxyPort, setProxyPort] = useState('1080')
  const [proxyUsername, setProxyUsername] = useState('')
  const [proxyPassword, setProxyPassword] = useState('')
  const [showProxyPwd, setShowProxyPwd] = useState(false)
  const [proxyTimeout, setProxyTimeout] = useState('10')
  const [jumpServerId, setJumpServerId] = useState<string | null>(null)

  // 环境变量 Tab
  const [envVars, setEnvVars] = useState<{ name: string; value: string }[]>([])
  const [selectedEnvIndex, setSelectedEnvIndex] = useState<number | null>(null)

  // 高级 Tab
  const [adv, setAdv] = useState({ ...defaultAdvanced })
  const updateAdv = useCallback(<K extends keyof typeof defaultAdvanced>(k: K, v: typeof defaultAdvanced[K]) =>
    setAdv(prev => ({ ...prev, [k]: v })), [])

  const protocols = useMemo(() =>
    batchEditIds.map(id => tableData.find(r => r.id === id)).filter(r => r?.type === 'asset').map(r => r!.protocol ?? 'ssh'),
    [batchEditIds, tableData],
  )
  const summary = useMemo(() => getProtocolSummary(protocols), [protocols])
  const sshConns = useMemo(() => connections.filter(c => c.protocol === 'ssh'), [connections])
  useEffect(() => {
    if (batchEditOpen) {
      api.getConnections().then(setConnections).catch(() => {})
      setActiveTab('basic')
      setColorTag(null); setEnvironment('不修改'); setUsername(''); setPort('')
      setAuthType('noChange'); setPassword(''); setShowPwd(false)
      setPrivateKeyId(''); setPrivateKeyPassword(''); setShowKeyPwd(false)
      setPrivateKeyName(''); setPresetName(''); setJumpKeyName('')
      setMfaSecret(''); setPresetId('')
      setJumpKeyId(''); setJumpKeyPassword(''); setShowJumpPwd(false)
      setAgentSocketPath('')
      setKeyModalFor(null); setShowPresetModal(false); setManagePresetId(undefined)
      setSyncProxy(false); setSyncEnv(false); setSyncAdvanced(false)
      setProxyType('关闭'); setProxyHost(''); setProxyPort('1080'); setProxyUsername(''); setProxyPassword(''); setShowProxyPwd(false); setProxyTimeout('10'); setJumpServerId(null)
      setEnvVars([]); setSelectedEnvIndex(null)
      setAdv({ ...defaultAdvanced })
    }
  }, [batchEditOpen])

  if (!batchEditOpen) return null

  // 是否有任何修改
  const hasChanges = colorTag !== null
    || environment !== '不修改'
    || username.trim() !== ''
    || port.trim() !== ''
    || authType !== 'noChange'
    || syncProxy || syncEnv || syncAdvanced

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
      // 代理
      if (syncProxy) {
        u.proxy_type = proxyType
        u.proxy_timeout = Number(proxyTimeout) || 10
        if (proxyType === 'SSH跳板') {
          u.jump_server_id = jumpServerId
        } else if (proxyType !== '关闭' && proxyType !== '自动') {
          u.proxy_host = proxyHost; u.proxy_port = Number(proxyPort) || 1080
          u.proxy_username = proxyUsername; u.proxy_password = proxyPassword
        }
      }
      // 环境变量
      if (syncEnv) {
        u.env_vars = JSON.stringify(envVars.filter(v => v.name.trim()))
      }
      // 高级
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
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[14px] font-bold text-text-1 tracking-wide">SSH 批量配置编辑</h2>
            <span className="text-[11px] text-text-3 bg-bg-hover px-2 py-0.5 rounded-full">{summary}</span>
          </div>
          <button onClick={closeBatchEdit} className="p-1.5 hover:bg-bg-hover rounded-md text-text-3 transition-colors">
            <AppIcon icon={icons.close} size={18} />
          </button>
        </div>

        {/* 白色岛屿内容区 */}
        <div className="flex-1 flex flex-col mx-4 bg-bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden min-h-0">
          {/* Tab 栏 */}
          <div className="flex justify-center mt-4 mb-3 shrink-0">
            <div className="bg-bg-base/80 p-0.5 rounded-lg inline-flex space-x-0.5">
              {TABS.map((tab) => {
                const disabled = (tab.key === 'proxy' && !syncProxy) || (tab.key === 'env' && !syncEnv) || (tab.key === 'advanced' && !syncAdvanced)
                return (
                  <button
                    key={tab.key}
                    onClick={() => !disabled && setActiveTab(tab.key)}
                    className={`px-4 py-1.5 text-xs rounded-md transition-all ${
                      disabled ? 'text-text-disabled cursor-not-allowed'
                      : activeTab === tab.key ? 'bg-bg-card shadow-sm text-text-1 font-medium'
                      : 'text-text-3 hover:text-text-2'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 表单内容滚动区 */}
          <div className="flex-1 overflow-y-auto px-7 py-2 custom-scrollbar">
            {activeTab === 'basic' && (
              <BasicTabContent
                colorTag={colorTag} setColorTag={setColorTag} environment={environment} setEnvironment={setEnvironment}
                username={username} setUsername={setUsername} port={port} setPort={setPort}
                authType={authType} setAuthType={setAuthType}
                password={password} setPassword={setPassword} showPwd={showPwd} setShowPwd={setShowPwd}
                privateKeyId={privateKeyId} setPrivateKeyId={setPrivateKeyId} privateKeyPassword={privateKeyPassword} setPrivateKeyPassword={setPrivateKeyPassword} showKeyPwd={showKeyPwd} setShowKeyPwd={setShowKeyPwd}
                privateKeyName={privateKeyName} jumpKeyName={jumpKeyName} presetName={presetName}
                mfaSecret={mfaSecret} setMfaSecret={setMfaSecret}
                presetId={presetId} setPresetId={setPresetId}
                jumpKeyId={jumpKeyId} setJumpKeyId={setJumpKeyId} jumpKeyPassword={jumpKeyPassword} setJumpKeyPassword={setJumpKeyPassword} showJumpPwd={showJumpPwd} setShowJumpPwd={setShowJumpPwd}
                agentSocketPath={agentSocketPath} setAgentSocketPath={setAgentSocketPath}
                syncProxy={syncProxy} setSyncProxy={setSyncProxy} syncEnv={syncEnv} setSyncEnv={setSyncEnv} syncAdvanced={syncAdvanced} setSyncAdvanced={setSyncAdvanced}
                proxyType={proxyType}
                onOpenKeyModal={setKeyModalFor} onOpenPresetModal={() => setShowPresetModal(true)}
              />
            )}
            {activeTab === 'proxy' && syncProxy && (
              <ProxyTabContent proxyType={proxyType} setProxyType={setProxyType} proxyHost={proxyHost} setProxyHost={setProxyHost} proxyPort={proxyPort} setProxyPort={setProxyPort} proxyUsername={proxyUsername} setProxyUsername={setProxyUsername} proxyPassword={proxyPassword} setProxyPassword={setProxyPassword} showProxyPwd={showProxyPwd} setShowProxyPwd={setShowProxyPwd} proxyTimeout={proxyTimeout} setProxyTimeout={setProxyTimeout} jumpServerId={jumpServerId} setJumpServerId={setJumpServerId} sshConns={sshConns} />
            )}
            {activeTab === 'env' && syncEnv && (
              <EnvVarsTabContent envVars={envVars} setEnvVars={setEnvVars} selectedIndex={selectedEnvIndex} setSelectedIndex={setSelectedEnvIndex} />
            )}
            {activeTab === 'advanced' && syncAdvanced && (
              <AdvancedTabContent adv={adv} updateAdv={updateAdv} />
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 flex justify-end shrink-0">
          <button
            className={`text-xs font-medium transition-colors ${!hasChanges || saving ? 'text-text-disabled cursor-not-allowed' : 'text-primary hover:opacity-80'}`}
            onClick={handleSave} disabled={!hasChanges || saving}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 私钥选择弹窗 */}
      {keyModalFor && (
        <SelectKeyModal
          onSelect={(keyId, keyName) => {
            if (keyModalFor === 'privateKey') { setPrivateKeyId(keyId); setPrivateKeyName(keyName) }
            else { setJumpKeyId(keyId); setJumpKeyName(keyName) }
            setKeyModalFor(null)
          }}
          onClose={() => setKeyModalFor(null)}
        />
      )}

      {/* 预设选择弹窗 */}
      {showPresetModal && (
        <SelectPresetModal
          onSelect={(id) => {
            setPresetId(id)
            api.getPresets().then(list => {
              const p = list.find(x => x.id === id)
              if (p) setPresetName(`${p.name} (${p.username})`)
            }).catch(() => {})
            setShowPresetModal(false)
          }}
          onClose={() => setShowPresetModal(false)}
          onManage={(editId) => { setShowPresetModal(false); setManagePresetId(editId ?? null) }}
        />
      )}

      {/* 预设管理弹窗（新建/编辑） */}
      {managePresetId !== undefined && (
        <ManagePresetModal
          editId={managePresetId}
          onClose={() => { setManagePresetId(undefined); setShowPresetModal(true) }}
          onSaved={() => { setManagePresetId(undefined); setShowPresetModal(true) }}
        />
      )}
    </div>
  )
}
/* ── 基础 Tab ── */
const BasicTabContent = memo(function BasicTabContent(props: {
  colorTag: string | null; setColorTag: (v: string | null) => void
  environment: string; setEnvironment: (v: string) => void
  username: string; setUsername: (v: string) => void
  port: string; setPort: (v: string) => void
  authType: string; setAuthType: (v: string) => void
  password: string; setPassword: (v: string) => void; showPwd: boolean; setShowPwd: (v: boolean) => void
  privateKeyId: string; setPrivateKeyId: (v: string) => void; privateKeyPassword: string; setPrivateKeyPassword: (v: string) => void; showKeyPwd: boolean; setShowKeyPwd: (v: boolean) => void
  privateKeyName: string; jumpKeyName: string; presetName: string
  mfaSecret: string; setMfaSecret: (v: string) => void
  presetId: string; setPresetId: (v: string) => void
  jumpKeyId: string; setJumpKeyId: (v: string) => void; jumpKeyPassword: string; setJumpKeyPassword: (v: string) => void; showJumpPwd: boolean; setShowJumpPwd: (v: boolean) => void
  agentSocketPath: string; setAgentSocketPath: (v: string) => void
  syncProxy: boolean; setSyncProxy: (v: boolean) => void; syncEnv: boolean; setSyncEnv: (v: boolean) => void; syncAdvanced: boolean; setSyncAdvanced: (v: boolean) => void
  proxyType: string
  onOpenKeyModal: (target: 'privateKey' | 'jump') => void; onOpenPresetModal: () => void
}) {
  const { colorTag, setColorTag, environment, setEnvironment, username, setUsername, port, setPort, authType, setAuthType } = props
  const jumpDisabled = !(props.syncProxy && props.proxyType === 'SSH跳板')
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in duration-200 pb-5">
      {/* 颜色标签 */}
      <div>
        <label className={labelClass}>颜色标签</label>
        <div className="flex items-center space-x-2 mt-1">
          {colors.map((c, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full ${c} cursor-pointer hover:scale-110 transition-transform ${colorTag === c ? 'ring-2 ring-primary ring-offset-1' : ''}`} onClick={() => setColorTag(colorTag === c ? null : c)} />
          ))}
          <button className="text-text-3 hover:text-text-2 ml-1" onClick={() => setColorTag(null)}>
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>
      </div>

      {/* 环境 */}
      <div>
        <label className={labelClass}>环境</label>
        <div className="relative">
          <select className={selectClass} value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            <option>不修改</option>
            <option>无</option>
            <option>开发</option>
            <option>预发布</option>
            <option>生产</option>
          </select>
          {chevronSvg}
        </div>
      </div>

      {/* User */}
      <div>
        <label className={labelClass}>User</label>
        <input type="text" className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="不填则不修改" />
      </div>

      {/* 端口 */}
      <div>
        <label className={labelClass}>端口</label>
        <input type="text" className={inputClass} value={port} onChange={(e) => setPort(e.target.value)} placeholder="不填则不修改" />
      </div>

      {/* 认证方式 pill 按钮 */}
      <div className="col-span-1 pr-4">
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {AUTH_TYPES.map((t) => {
            const disabled = t.id === 'jump' && jumpDisabled
            return (
              <button
                key={t.id}
                onClick={() => !disabled && setAuthType(t.id)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors border ${
                  disabled ? 'bg-bg-base border-transparent text-text-disabled cursor-not-allowed'
                  : authType === t.id ? 'bg-primary/5 border-primary/20 text-primary font-medium'
                  : 'bg-bg-base border-transparent text-text-2 hover:bg-bg-hover'
                }`}
                title={disabled ? '请先在代理设置中配置 SSH 跳板' : undefined}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 动态认证字段 */}
      <div className="col-span-1 relative mt-0.5">
        <BatchAuthFields {...props} onOpenKeyModal={props.onOpenKeyModal} onOpenPresetModal={props.onOpenPresetModal} />
      </div>

      {/* 同步开关 */}
      <div className="col-span-2 flex items-center gap-6 pt-2 border-t border-border/50">
        <SyncCheckbox label="同步代理配置" checked={props.syncProxy} onChange={props.setSyncProxy} />
        <SyncCheckbox label="同步环境变量" checked={props.syncEnv} onChange={props.setSyncEnv} />
        <SyncCheckbox label="同步高级配置" checked={props.syncAdvanced} onChange={props.setSyncAdvanced} />
      </div>
    </div>
  )
})

function SyncCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none text-text-2 hover:text-text-1 transition-colors">
      <input type="checkbox" checked={checked} onChange={() => onChange(!checked)} className="accent-primary w-3 h-3" />
      {label}
    </label>
  )
}
/* ── 认证字段动态渲染 ── */
const BatchAuthFields = memo(function BatchAuthFields(props: {
  authType: string
  password: string; setPassword: (v: string) => void; showPwd: boolean; setShowPwd: (v: boolean) => void
  privateKeyId: string; setPrivateKeyId: (v: string) => void; privateKeyPassword: string; setPrivateKeyPassword: (v: string) => void; showKeyPwd: boolean; setShowKeyPwd: (v: boolean) => void
  privateKeyName: string; jumpKeyName: string; presetName: string
  mfaSecret: string; setMfaSecret: (v: string) => void
  presetId: string; setPresetId: (v: string) => void
  jumpKeyId: string; setJumpKeyId: (v: string) => void; jumpKeyPassword: string; setJumpKeyPassword: (v: string) => void; showJumpPwd: boolean; setShowJumpPwd: (v: boolean) => void
  agentSocketPath: string; setAgentSocketPath: (v: string) => void
  onOpenKeyModal: (target: 'privateKey' | 'jump') => void; onOpenPresetModal: () => void
}) {
  const anim = 'animate-in fade-in slide-in-from-right-4 duration-300'

  if (props.authType === 'password') {
    return (
      <div className={anim}>
        <label className={labelClass}>密码</label>
        <div className="relative">
          <input type={props.showPwd ? 'text' : 'password'} className={inputClass} value={props.password} onChange={(e) => props.setPassword(e.target.value)} placeholder="所有选中连接将使用此密码" />
          <button onClick={() => props.setShowPwd(!props.showPwd)} className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2">
            {props.showPwd ? <AppIcon icon={icons.eye} size={16} /> : <AppIcon icon={icons.eyeOff} size={16} />}
          </button>
        </div>
      </div>
    )
  }

  if (props.authType === 'privateKey') {
    return (
      <div className={`space-y-4 ${anim}`}>
        <div>
          <label className={labelClass}>私钥</label>
          <div className="relative">
            <input type="text" className={`${inputClass} pr-8`} readOnly value={props.privateKeyName || props.privateKeyId} placeholder="请选择私钥" />
            <button onClick={() => props.onOpenKeyModal('privateKey')} className="absolute right-1.5 top-1 p-1 text-text-3 hover:text-text-2 hover:bg-bg-hover rounded">
              <AppIcon icon={icons.crosshair} size={14} />
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass}>私钥密码</label>
          <div className="relative">
            <input type={props.showKeyPwd ? 'text' : 'password'} className={inputClass} value={props.privateKeyPassword} onChange={(e) => props.setPrivateKeyPassword(e.target.value)} placeholder="可选" />
            <button onClick={() => props.setShowKeyPwd(!props.showKeyPwd)} className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2">
              {props.showKeyPwd ? <AppIcon icon={icons.eye} size={16} /> : <AppIcon icon={icons.eyeOff} size={16} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (props.authType === 'mfa') {
    return (
      <div className={anim}>
        <label className={labelClass}>MFA 认证密钥 (Secret)</label>
        <input type="text" className={inputClass} placeholder="可选，留空则连接时手动输入" value={props.mfaSecret} onChange={(e) => props.setMfaSecret(e.target.value)} />
        <p className="text-text-3 text-[10px] mt-1.5 leading-relaxed">配置密钥后将自动计算验证码并填充。</p>
      </div>
    )
  }

  if (props.authType === 'preset') {
    return (
      <div className={anim}>
        <label className={labelClass}>预设账号密码</label>
        <div className="relative">
          <input type="text" className={`${inputClass} pr-8`} readOnly value={props.presetName || props.presetId} placeholder="请选择预设" />
          <button onClick={() => props.onOpenPresetModal()} className="absolute right-1.5 top-1 p-1 text-text-3 hover:text-text-2 hover:bg-bg-hover rounded">
            <AppIcon icon={icons.crosshair} size={14} />
          </button>
        </div>
      </div>
    )
  }

  if (props.authType === 'jump') {
    return (
      <div className={`space-y-4 ${anim}`}>
        <div>
          <label className={labelClass}>跳板机私钥</label>
          <div className="relative">
            <input type="text" className={`${inputClass} pr-8`} readOnly value={props.jumpKeyName || props.jumpKeyId} placeholder="请选择跳板机的私钥凭证" />
            <button onClick={() => props.onOpenKeyModal('jump')} className="absolute right-1.5 top-1 p-1 text-text-3 hover:text-text-2 hover:bg-bg-hover rounded">
              <AppIcon icon={icons.crosshair} size={14} />
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass}>密码</label>
          <div className="relative">
            <input type={props.showJumpPwd ? 'text' : 'password'} className={inputClass} value={props.jumpKeyPassword} onChange={(e) => props.setJumpKeyPassword(e.target.value)} placeholder="私钥密码(可选)" />
            <button onClick={() => props.setShowJumpPwd(!props.showJumpPwd)} className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2">
              {props.showJumpPwd ? <AppIcon icon={icons.eye} size={16} /> : <AppIcon icon={icons.eyeOff} size={16} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (props.authType === 'agent') {
    return (
      <div className={anim}>
        <label className={labelClass}>Agent Socket 路径</label>
        <input type="text" className={inputClass} placeholder="留空自动检测" value={props.agentSocketPath} onChange={(e) => props.setAgentSocketPath(e.target.value)} />
      </div>
    )
  }

  return null
})
/* ── 代理 Tab（与 SshConfigDialog ProxyTab 一致） ── */
const ProxyTabContent = memo(function ProxyTabContent({ proxyType, setProxyType, proxyHost, setProxyHost, proxyPort, setProxyPort, proxyUsername, setProxyUsername, proxyPassword, setProxyPassword, showProxyPwd, setShowProxyPwd, proxyTimeout, setProxyTimeout, jumpServerId, setJumpServerId, sshConns }: {
  proxyType: string; setProxyType: (v: string) => void
  proxyHost: string; setProxyHost: (v: string) => void
  proxyPort: string; setProxyPort: (v: string) => void
  proxyUsername: string; setProxyUsername: (v: string) => void
  proxyPassword: string; setProxyPassword: (v: string) => void
  showProxyPwd: boolean; setShowProxyPwd: (v: boolean) => void
  proxyTimeout: string; setProxyTimeout: (v: string) => void
  jumpServerId: string | null; setJumpServerId: (v: string | null) => void
  sshConns: Connection[]
}) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in duration-200 pb-5">
      {/* 代理方式 */}
      <div>
        <label className={labelClass}>代理方式</label>
        <div className="relative">
          <select className={selectClass} value={proxyType} onChange={(e) => setProxyType(e.target.value)}>
            {PROXY_TYPES.map(o => <option key={o}>{o}</option>)}
          </select>
          {chevronSvg}
        </div>
      </div>

      {/* 连接超时 */}
      <div>
        <label className={labelClass}>连接超时(秒)</label>
        <input type="text" className={inputClass} value={proxyTimeout} onChange={(e) => setProxyTimeout(e.target.value)} />
      </div>

      {/* SSH 跳板 */}
      {proxyType === 'SSH跳板' ? (
        <div className="col-span-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <label className={labelClass}>SSH隧道</label>
          <div className="relative">
            <select className={selectClass} value={jumpServerId || ''} onChange={(e) => setJumpServerId(e.target.value || null)}>
              <option value="">请选择跳板机</option>
              {sshConns.map(c => <option key={c.id} value={c.id}>{c.name} ({c.host})</option>)}
            </select>
            {chevronSvg}
          </div>
        </div>
      ) : proxyType !== '关闭' && proxyType !== '自动' ? (
        <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <label className={labelClass}>Host</label>
            <input type="text" className={inputClass} value={proxyHost} onChange={(e) => setProxyHost(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>端口</label>
            <input type="text" className={inputClass} value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>账号</label>
            <input type="text" className={inputClass} value={proxyUsername} onChange={(e) => setProxyUsername(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>密码</label>
            <div className="relative">
              <input type={showProxyPwd ? 'text' : 'password'} className={inputClass} value={proxyPassword} onChange={(e) => setProxyPassword(e.target.value)} />
              <button onClick={() => setShowProxyPwd(!showProxyPwd)} className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2">
                {showProxyPwd ? <AppIcon icon={icons.eye} size={16} /> : <AppIcon icon={icons.eyeOff} size={16} />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
})
/* ── 环境变量 Tab（与 SshConfigDialog EnvVarsTab 一致） ── */
const EnvVarsTabContent = memo(function EnvVarsTabContent({ envVars, setEnvVars, selectedIndex, setSelectedIndex }: {
  envVars: { name: string; value: string }[]; setEnvVars: (v: { name: string; value: string }[]) => void
  selectedIndex: number | null; setSelectedIndex: (v: number | null) => void
}) {
  const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; x: number; y: number; index: number | null }>({ visible: false, x: 0, y: 0, index: null })

  useEffect(() => {
    const close = () => setCtxMenu(p => ({ ...p, visible: false }))
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const handleCtx = (e: React.MouseEvent, index: number | null) => {
    e.preventDefault(); e.stopPropagation()
    setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, index })
  }

  const addVar = () => setEnvVars([...envVars, { name: 'NEW_VAR', value: '' }])
  const removeVar = (i: number) => {
    setEnvVars(envVars.filter((_, idx) => idx !== i))
    setSelectedIndex(null)
  }
  const updateVar = (i: number, field: 'name' | 'value', val: string) =>
    setEnvVars(envVars.map((v, idx) => idx === i ? { ...v, [field]: val } : v))

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-200 pb-3">
      <div className="border border-border rounded flex-1 flex flex-col overflow-hidden">
        {/* 表头 */}
        <div className="flex flex-row border-b border-border bg-bg-subtle">
          <div className="w-[200px] min-w-[200px] px-3 py-1.5 text-[11px] text-text-2 font-medium border-r border-border">名称</div>
          <div className="flex-1 px-3 py-1.5 text-[11px] text-text-2 font-medium">值</div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto bg-bg-card flex flex-col" onContextMenu={(e) => handleCtx(e, null)}>
          {envVars.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-3 min-h-[250px]">
              <AppIcon icon={icons.cloudSun} size={56} className="mb-3" />
              <p className="text-xs">鼠标右键添加环境变量</p>
            </div>
          ) : (
            <div className="flex-1">
              {envVars.map((env, i) => (
                <div
                  key={i}
                  className={`flex flex-row border-b border-border/30 cursor-pointer transition-colors ${selectedIndex === i ? 'bg-primary/5' : 'hover:bg-bg-hover'}`}
                  onClick={() => setSelectedIndex(i)}
                  onContextMenu={(e) => handleCtx(e, i)}
                >
                  <div className="w-[200px] min-w-[200px] border-r border-border/30">
                    <input type="text" className="w-full bg-transparent px-3 py-1.5 text-xs text-text-1 outline-none" value={env.name} onChange={(e) => updateVar(i, 'name', e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <input type="text" className="w-full bg-transparent px-3 py-1.5 text-xs text-text-1 outline-none" value={env.value} onChange={(e) => updateVar(i, 'value', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      {ctxMenu.visible && (
        <div className="fixed bg-bg-card shadow-xl rounded border border-border py-1 w-28 z-50 animate-in fade-in zoom-in-95 duration-100" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          <div className="text-[10px] text-text-3 px-3 py-1 mb-1 border-b border-border/50">操作</div>
          <button className="w-full text-left px-3 py-1.5 text-xs text-text-1 hover:bg-bg-hover flex items-center" onClick={() => { addVar(); setCtxMenu(p => ({ ...p, visible: false })) }}>
            <AppIcon icon={icons.link} size={12} className="mr-2 text-text-3" /> 新建
          </button>
          <button className="w-full text-left px-3 py-1.5 text-xs text-text-1 hover:bg-bg-hover flex items-center" onClick={() => { if (ctxMenu.index !== null) removeVar(ctxMenu.index); setCtxMenu(p => ({ ...p, visible: false })) }}>
            <AppIcon icon={icons.close} size={12} className="mr-2 text-text-3" /> 删除
          </button>
        </div>
      )}
    </div>
  )
})
/* ── 高级 Tab（与 SshConfigDialog AdvancedTab 一致） ── */
const AdvancedTabContent = memo(function AdvancedTabContent({ adv, updateAdv }: {
  adv: typeof defaultAdvanced
  updateAdv: <K extends keyof typeof defaultAdvanced>(k: K, v: typeof defaultAdvanced[K]) => void
}) {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-200 pb-6">
      {/* 功能开关 2×4 网格 */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6 px-1">
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="启用 SFTP" checked={adv.sftp} onChange={() => updateAdv('sftp', !adv.sftp)} />
          <CheckItem label="启用 lrzsz" tooltip="启用后，支持 rz/sz 命令传输文件" checked={adv.lrzsz} onChange={() => updateAdv('lrzsz', !adv.lrzsz)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="启用 trzsz" checked={adv.trzsz} onChange={() => {}} disabled />
          <CheckItem label="SFTP-SUDO" tooltip="启用后，SFTP 将自动使用 root 用户操作文件，请保证该账号具备 sudo 权限！" checked={adv.sftpSudo} onChange={() => updateAdv('sftpSudo', !adv.sftpSudo)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="启用 X11 转发" tooltip="开启 X11 转发后，需安装并打开 Xming!" checked={adv.x11} onChange={() => updateAdv('x11', !adv.x11)} />
          <CheckItem label="终端增强模式" tooltip="启用后，支持 hex-rz, hex-sz, hex-edit, hex-open 等增强命令" checked={adv.terminalEnhance} onChange={() => updateAdv('terminalEnhance', !adv.terminalEnhance)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="纯终端模式" tooltip="启用后，提供纯终端视图，在连接堡垒机，交换机，路由器等设备，需要打开此选项" checked={adv.pureTerminal} onChange={() => updateAdv('pureTerminal', !adv.pureTerminal)} />
          <CheckItem label="录制日志" tooltip="启用后，将自动录制终端输出至日志文件，请提前在设置-SSH/SFTP 页面中设置储存路径" checked={adv.recordLog} onChange={() => updateAdv('recordLog', !adv.recordLog)} />
        </div>
      </div>

      {/* 表单字段 */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
        <div>
          <label className={labelClass}>X11 Display</label>
          <input type="text" className={`${inputClass} ${!adv.x11 ? 'bg-bg-hover text-text-disabled select-none' : ''}`} value={adv.x11Display} onChange={(e) => updateAdv('x11Display', e.target.value)} disabled={!adv.x11} />
        </div>
        <div>
          <label className={labelClass}>SFTP 命令</label>
          <input type="text" className={inputClass} value={adv.sftpCommand} onChange={(e) => updateAdv('sftpCommand', e.target.value)} />
        </div>
        <div>
          <HoverTooltip text="值大于 0 则开启，超过时间未输入会自动清空输入+回车">
            <label className={labelClass}>终端心跳时间(秒)</label>
          </HoverTooltip>
          <input type="text" className={inputClass} value={adv.heartbeat} onChange={(e) => updateAdv('heartbeat', e.target.value)} />
          <p className="text-text-3 text-[10px] mt-1 truncate">值大于 0 则开启，超过时间未输入会自动清...</p>
        </div>
        <div>
          <label className={labelClass}>连接超时(秒)</label>
          <input type="text" className={inputClass} value={adv.connectTimeout} onChange={(e) => updateAdv('connectTimeout', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>编码</label>
          <div className="relative">
            <select className={selectClass} value={adv.encoding} onChange={(e) => updateAdv('encoding', e.target.value)}>
              {ENCODINGS.map(enc => <option key={enc}>{enc}</option>)}
            </select>
            {chevronSvg}
          </div>
        </div>
        <div>
          <label className={labelClass}>终端类型</label>
          <div className="relative">
            <select className={selectClass} value={adv.terminalType} onChange={(e) => updateAdv('terminalType', e.target.value)}>
              {TERM_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            {chevronSvg}
          </div>
        </div>
        <div>
          <label className={labelClass}>SFTP 默认路径</label>
          <input type="text" className={inputClass} value={adv.sftpDefaultPath} onChange={(e) => updateAdv('sftpDefaultPath', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>到期时间</label>
          <input type="date" className={`${inputClass} ${!adv.expireDate ? 'text-text-3' : ''}`} value={adv.expireDate} onChange={(e) => updateAdv('expireDate', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>初始执行命令</label>
          <textarea className={`${inputClass} min-h-[60px] resize-none`} value={adv.initCommand} onChange={(e) => updateAdv('initCommand', e.target.value)} />
        </div>
      </div>
    </div>
  )
})

/* ── CheckItem 辅助组件 ── */
const CheckItem = memo(function CheckItem({ label, tooltip, checked, onChange, disabled }: {
  label: string; tooltip?: string; checked: boolean; onChange: () => void; disabled?: boolean
}) {
  const inner = (
    <label className={`flex items-center gap-1.5 text-xs cursor-pointer select-none ${disabled ? 'text-text-disabled cursor-not-allowed' : 'text-text-1'}`}>
      <input type="checkbox" className={`accent-primary w-3 h-3 ${disabled ? 'grayscale opacity-50 cursor-not-allowed' : ''}`} checked={checked} onChange={disabled ? undefined : onChange} readOnly={disabled} />
      {label}
    </label>
  )
  return tooltip ? <HoverTooltip text={tooltip} disabled={disabled && !tooltip}>{inner}</HoverTooltip> : inner
})
