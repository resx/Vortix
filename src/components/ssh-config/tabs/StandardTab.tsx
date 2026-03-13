import { useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import type { AuthType } from '../../../stores/useSshConfigStore'

const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500', 'bg-cyan-500', 'bg-blue-500', 'bg-purple-500', 'bg-gray-500']

const authTypes: { id: AuthType; label: string }[] = [
  { id: 'password', label: '密码' },
  { id: 'privateKey', label: '私钥' },
  { id: 'mfa', label: 'MFA/2FA' },
  { id: 'preset', label: '预设账号密码' },
  { id: 'jump', label: '跳板机私钥' },
  { id: 'agent', label: 'SSH Agent' },
  { id: 'none', label: '不验证' },
]

const inputClass = 'w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1'
const labelClass = 'block text-xs text-text-2 mb-1.5'

function errorInputClass(hasError: boolean) {
  return hasError
    ? 'w-full bg-bg-base border border-red-300 rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-red-400 focus:ring-1 focus:ring-red-300 transition-all placeholder-text-3 text-text-1'
    : inputClass
}

export default function StandardTab() {
  const store = useSshConfigStore()
  const [showPassword, setShowPassword] = useState(false)
  const [showAgentTooltip, setShowAgentTooltip] = useState(false)

  const err = store.errors

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in duration-200 pb-5">
      {/* 颜色标签 */}
      <div>
        <label className={labelClass}>颜色标签</label>
        <div className="flex items-center space-x-2 mt-1">
          {colors.map((c, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full ${c} cursor-pointer hover:scale-110 transition-transform ${store.colorTag === c ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              onClick={() => store.setField('colorTag', store.colorTag === c ? null : c)}
            />
          ))}
          <button
            className="text-text-3 hover:text-text-2 ml-1"
            onClick={() => store.setField('colorTag', null)}
          >
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>
      </div>

      {/* 环境 */}
      <div>
        <label className={labelClass}>环境</label>
        <div className="relative">
          <select
            className={`${inputClass} appearance-none cursor-pointer`}
            value={store.environment}
            onChange={(e) => store.setField('environment', e.target.value)}
          >
            <option>无</option>
            <option>开发</option>
            <option>生产</option>
          </select>
          <svg className="absolute right-2.5 top-2 text-text-3 pointer-events-none w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </div>

      {/* 名称 */}
      <div>
        <label className={`${labelClass} ${err.name ? 'text-red-500' : ''}`}>名称</label>
        <input
          type="text"
          className={errorInputClass(!!err.name)}
          value={store.name}
          onChange={(e) => { store.setField('name', e.target.value); store.clearError('name') }}
        />
        {err.name && <p className="text-red-500 text-[10px] mt-1 tracking-wide">{err.name}</p>}
      </div>

      {/* Host */}
      <div>
        <label className={`${labelClass} ${err.host ? 'text-red-500' : ''}`}>Host</label>
        <input
          type="text"
          className={errorInputClass(!!err.host)}
          value={store.host}
          onChange={(e) => { store.setField('host', e.target.value); store.clearError('host') }}
        />
        {err.host && <p className="text-red-500 text-[10px] mt-1 tracking-wide">{err.host}</p>}
      </div>

      {/* User */}
      <div>
        <label className={labelClass}>User</label>
        <input
          type="text"
          className={inputClass}
          value={store.user}
          onChange={(e) => store.setField('user', e.target.value)}
        />
      </div>

      {/* 端口 */}
      <div>
        <label className={labelClass}>端口</label>
        <input
          type="text"
          className={inputClass}
          value={store.port}
          onChange={(e) => store.setField('port', e.target.value)}
        />
      </div>

      {/* 认证方式 pill 按钮 */}
      <div className="col-span-1 pr-4">
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {authTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => store.setField('authType', type.id)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors border ${
                store.authType === type.id
                  ? 'bg-primary/5 border-primary/20 text-primary font-medium'
                  : 'bg-bg-base border-transparent text-text-2 hover:bg-bg-hover'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* 动态认证字段 */}
      <div className="col-span-1 relative mt-0.5">
        <AuthFields
          store={store}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showAgentTooltip={showAgentTooltip}
          setShowAgentTooltip={setShowAgentTooltip}
        />
      </div>

      {/* 备注 */}
      <div className="col-span-2 mt-1 mb-2">
        <label className={labelClass}>备注</label>
        <textarea
          className={`${inputClass} min-h-[50px] resize-none`}
          value={store.remark}
          onChange={(e) => store.setField('remark', e.target.value)}
        />
      </div>
    </div>
  )
}

function AuthFields({
  store,
  showPassword,
  setShowPassword,
  showAgentTooltip,
  setShowAgentTooltip,
}: {
  store: ReturnType<typeof useSshConfigStore.getState>
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  showAgentTooltip: boolean
  setShowAgentTooltip: (v: boolean) => void
}) {
  const err = store.errors
  const anim = 'animate-in fade-in slide-in-from-right-4 duration-300'

  // 密码
  if (store.authType === 'password') {
    return (
      <div className={anim}>
        <label className={labelClass}>密码</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            className={inputClass}
            value={store.password}
            onChange={(e) => store.setField('password', e.target.value)}
          />
          <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2">
            {showPassword ? <AppIcon icon={icons.eye} size={16} /> : <AppIcon icon={icons.eyeOff} size={16} />}
          </button>
        </div>
      </div>
    )
  }

  // 私钥
  if (store.authType === 'privateKey') {
    return (
      <div className={`space-y-4 ${anim}`}>
        <div>
          <label className={`${labelClass} ${err.privateKey ? 'text-red-500' : ''}`}>私钥</label>
          <div className="relative">
            <input type="text" className={`${errorInputClass(!!err.privateKey)} pr-8`} readOnly value={store.privateKeyName || ''} placeholder="请选择私钥" />
            <button onClick={() => store.toggleSubModal('selectKey', true)} className="absolute right-1.5 top-1 p-1 text-text-3 hover:text-text-2 hover:bg-bg-hover rounded">
              <AppIcon icon={icons.crosshair} size={14} />
            </button>
          </div>
          {err.privateKey && <p className="text-red-500 text-[10px] mt-1 tracking-wide">{err.privateKey}</p>}
        </div>
        <div>
          <label className={labelClass}>密码</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className={inputClass}
              value={store.privateKeyPassword}
              onChange={(e) => store.setField('privateKeyPassword', e.target.value)}
            />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2">
              {showPassword ? <AppIcon icon={icons.eye} size={16} /> : <AppIcon icon={icons.eyeOff} size={16} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // MFA/2FA
  if (store.authType === 'mfa') {
    return (
      <div className={anim}>
        <label className={labelClass}>MFA 认证密钥 (Secret)</label>
        <div className="relative">
          <input
            type="text"
            className={`${inputClass} pr-8`}
            placeholder="可选，留空则连接时手动输入"
            value={store.mfaSecret}
            onChange={(e) => store.setField('mfaSecret', e.target.value)}
          />
          <button className="absolute right-1.5 top-1 p-1 text-text-3 hover:text-text-2 hover:bg-bg-hover rounded" title="选择已有密钥">
            <AppIcon icon={icons.crosshair} size={14} />
          </button>
        </div>
        <p className="text-text-3 text-[10px] mt-1.5 leading-relaxed">配置密钥后将自动计算验证码并填充。若服务器采用 Keyboard-Interactive 交互式提示，也可留空手动输入。</p>
      </div>
    )
  }

  // 预设账号密码
  if (store.authType === 'preset') {
    return (
      <div className={anim}>
        <label className={`${labelClass} ${err.presetId ? 'text-red-500' : ''}`}>预设账号密码</label>
        <div className="relative">
          <input type="text" className={`${errorInputClass(!!err.presetId)} pr-8`} readOnly value={store.presetName || ''} placeholder="请选择预设账号密码" />
          <button onClick={() => store.toggleSubModal('selectPreset', true)} className="absolute right-1.5 top-1 p-1 text-text-3 hover:text-text-2 hover:bg-bg-hover rounded">
            <AppIcon icon={icons.crosshair} size={14} />
          </button>
        </div>
        {err.presetId && <p className="text-red-500 text-[10px] mt-1 tracking-wide">{err.presetId}</p>}
      </div>
    )
  }

  // 跳板机私钥
  if (store.authType === 'jump') {
    return (
      <div className={`space-y-4 ${anim}`}>
        <div>
          <label className={`${labelClass} ${err.jumpKey ? 'text-red-500' : ''}`}>跳板机私钥</label>
          <div className="relative">
            <input type="text" className={`${errorInputClass(!!err.jumpKey)} pr-8`} readOnly placeholder="请选择跳板机的私钥凭证" value={store.jumpKeyName || ''} />
            <button onClick={() => store.toggleSubModal('selectKey', true)} className="absolute right-1.5 top-1 p-1 text-text-3 hover:text-text-2 hover:bg-bg-hover rounded">
              <AppIcon icon={icons.crosshair} size={14} />
            </button>
          </div>
          {err.jumpKey && <p className="text-red-500 text-[10px] mt-1 tracking-wide">{err.jumpKey}</p>}
        </div>
        <div>
          <label className={labelClass}>密码</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className={inputClass}
              placeholder="私钥密码(可选)"
              value={store.jumpKeyPassword}
              onChange={(e) => store.setField('jumpKeyPassword', e.target.value)}
            />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2">
              {showPassword ? <AppIcon icon={icons.eye} size={16} /> : <AppIcon icon={icons.eyeOff} size={16} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // SSH Agent
  if (store.authType === 'agent') {
    return (
      <div className={anim}>
        <label className={labelClass}>Agent Socket 路径</label>
        <div className="relative">
          <input
            type="text"
            className={`${inputClass} pr-8`}
            placeholder="留空自动检测"
            value={store.agentSocketPath}
            onChange={(e) => store.setField('agentSocketPath', e.target.value)}
          />
          <button
            onMouseEnter={() => setShowAgentTooltip(true)}
            onMouseLeave={() => setShowAgentTooltip(false)}
            className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2 cursor-help"
          >
            <AppIcon icon={icons.help} size={16} />
          </button>
          {showAgentTooltip && (
            <div className="absolute top-9 right-0 w-[450px] bg-tooltip-bg text-tooltip-text text-[11px] rounded-md shadow-xl p-3 z-50">
              <ul className="list-disc pl-4 space-y-1.5 leading-relaxed">
                <li>留空自动检测，先尝试连接 OpenSSH for Windows(需保证 ssh-agent 命令可执行)，再尝试连接 Pageant，最终再尝试读取环境变量 $SSH_AUTH_SOCK 管道路径</li>
                <li>可直接输入环境变量名称，例如 <span className="text-white">$SSH_AUTH_SOCK</span></li>
                <li>可直接输入通信管道路径，例如 <span className="text-white">\\.\pipe\openssh-ssh-agent</span></li>
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 不验证
  return null
}
