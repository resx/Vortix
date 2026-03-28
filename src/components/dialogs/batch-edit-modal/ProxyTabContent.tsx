import { memo } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { chevronSvg, inputClass, labelClass, PROXY_TYPES, selectClass } from './constants'
import type { ProxyTabProps } from './types'

export const ProxyTabContent = memo(function ProxyTabContent({
  proxyType,
  setProxyType,
  proxyHost,
  setProxyHost,
  proxyPort,
  setProxyPort,
  proxyUsername,
  setProxyUsername,
  proxyPassword,
  setProxyPassword,
  showProxyPwd,
  setShowProxyPwd,
  proxyTimeout,
  setProxyTimeout,
  jumpServerId,
  setJumpServerId,
  sshConns,
}: ProxyTabProps) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in duration-200 pb-5">
      <div>
        <label className={labelClass}>代理方式</label>
        <div className="relative">
          <select className={selectClass} value={proxyType} onChange={(e) => setProxyType(e.target.value)}>
            {PROXY_TYPES.map((o) => <option key={o}>{o}</option>)}
          </select>
          {chevronSvg}
        </div>
      </div>

      <div>
        <label className={labelClass}>连接超时(秒)</label>
        <input type="text" className={inputClass} value={proxyTimeout} onChange={(e) => setProxyTimeout(e.target.value)} />
      </div>

      {proxyType === 'SSH跳板' ? (
        <div className="col-span-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <label className={labelClass}>SSH隧道</label>
          <div className="relative">
            <select className={selectClass} value={jumpServerId || ''} onChange={(e) => setJumpServerId(e.target.value || null)}>
              <option value="">请选择跳板机</option>
              {sshConns.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.host})</option>)}
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
