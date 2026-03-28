import { AppIcon, icons } from '../../../icons/AppIcon'
import { useSshConfigStore } from '../../../../stores/useSshConfigStore'
import { errorInputClass, inputClass, labelClass } from './constants'

interface AuthFieldsProps {
  store: ReturnType<typeof useSshConfigStore.getState>
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  showAgentTooltip: boolean
  setShowAgentTooltip: (v: boolean) => void
}

export function AuthFields({
  store,
  showPassword,
  setShowPassword,
  showAgentTooltip,
  setShowAgentTooltip,
}: AuthFieldsProps) {
  const err = store.errors
  const anim = 'animate-in fade-in slide-in-from-right-4 duration-300'

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

  return null
}
