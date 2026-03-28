import { memo } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { AUTH_TYPES, chevronSvg, colors, inputClass, labelClass, selectClass } from './constants'
import type { BasicTabProps } from './types'

function SyncCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none text-text-2 hover:text-text-1 transition-colors">
      <input type="checkbox" checked={checked} onChange={() => onChange(!checked)} className="accent-primary w-3 h-3" />
      {label}
    </label>
  )
}

const BatchAuthFields = memo(function BatchAuthFields(props: BasicTabProps) {
  const anim = 'animate-in fade-in slide-in-from-right-4 duration-300'

  if (props.authType === 'password') {
    return (
      <div className={anim}>
        <label className={labelClass}>密码</label>
        <div className="relative">
          <input
            type={props.showPwd ? 'text' : 'password'}
            className={inputClass}
            value={props.password}
            onChange={(e) => props.setPassword(e.target.value)}
            placeholder="所有选中连接将使用此密码"
          />
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

export const BasicTabContent = memo(function BasicTabContent(props: BasicTabProps) {
  const jumpDisabled = !(props.syncProxy && props.proxyType === 'SSH跳板')
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in duration-200 pb-5">
      <div>
        <label className={labelClass}>颜色标签</label>
        <div className="flex items-center space-x-2 mt-1">
          {colors.map((c, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full ${c} cursor-pointer hover:scale-110 transition-transform ${props.colorTag === c ? 'ring-2 ring-primary ring-offset-1' : ''}`} onClick={() => props.setColorTag(props.colorTag === c ? null : c)} />
          ))}
          <button className="text-text-3 hover:text-text-2 ml-1" onClick={() => props.setColorTag(null)}>
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>环境</label>
        <div className="relative">
          <select className={selectClass} value={props.environment} onChange={(e) => props.setEnvironment(e.target.value)}>
            <option>不修改</option>
            <option>无</option>
            <option>开发</option>
            <option>预发布</option>
            <option>生产</option>
          </select>
          {chevronSvg}
        </div>
      </div>

      <div>
        <label className={labelClass}>User</label>
        <input type="text" className={inputClass} value={props.username} onChange={(e) => props.setUsername(e.target.value)} placeholder="不填则不修改" />
      </div>

      <div>
        <label className={labelClass}>端口</label>
        <input type="text" className={inputClass} value={props.port} onChange={(e) => props.setPort(e.target.value)} placeholder="不填则不修改" />
      </div>

      <div className="col-span-1 pr-4">
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {AUTH_TYPES.map((t) => {
            const disabled = t.id === 'jump' && jumpDisabled
            return (
              <button
                key={t.id}
                onClick={() => !disabled && props.setAuthType(t.id)}
                className={`px-2.5 py-1 text-xs rounded-full transition-colors border ${
                  disabled
                    ? 'bg-bg-base border-transparent text-text-disabled cursor-not-allowed'
                    : props.authType === t.id
                      ? 'bg-primary/5 border-primary/20 text-primary font-medium'
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

      <div className="col-span-1 relative mt-0.5">
        <BatchAuthFields {...props} />
      </div>

      <div className="col-span-2 flex items-center gap-6 pt-2 border-t border-border/50">
        <SyncCheckbox label="同步代理配置" checked={props.syncProxy} onChange={props.setSyncProxy} />
        <SyncCheckbox label="同步环境变量" checked={props.syncEnv} onChange={props.setSyncEnv} />
        <SyncCheckbox label="同步高级配置" checked={props.syncAdvanced} onChange={props.setSyncAdvanced} />
      </div>
    </div>
  )
})
