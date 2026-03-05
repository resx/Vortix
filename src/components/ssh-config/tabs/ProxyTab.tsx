import { useState } from 'react'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import type { ProxyType } from '../../../stores/useSshConfigStore'

const inputClass = 'w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1'
const labelClass = 'block text-xs text-text-2 mb-1.5'

const proxyOptions: ProxyType[] = ['关闭', '自动', 'SOCKS5', 'HTTP', 'HTTPS', 'SSH跳板']

export default function ProxyTab() {
  const store = useSshConfigStore()
  const [showProxyPwd, setShowProxyPwd] = useState(false)
  const err = store.errors

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in duration-200 pb-5">
      {/* 代理方式 */}
      <div>
        <label className={labelClass}>代理方式</label>
        <div className="relative">
          <select
            className={`${inputClass} appearance-none cursor-pointer`}
            value={store.proxyType}
            onChange={(e) => {
              const val = e.target.value as ProxyType
              store.setField('proxyType', val)
              if (val === 'SSH跳板') store.toggleSubModal('selectAsset', true)
            }}
          >
            {proxyOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-2 text-text-3 pointer-events-none" />
        </div>
      </div>

      {/* 连接超时 */}
      <div>
        <label className={labelClass}>连接超时(秒)</label>
        <input
          type="text"
          className={inputClass}
          value={store.proxyTimeout}
          onChange={(e) => store.setField('proxyTimeout', e.target.value)}
        />
      </div>

      {/* 动态区域 */}
      {store.proxyType === 'SSH跳板' ? (
        <div className="col-span-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <label className={`${labelClass} ${err.jumpServer ? 'text-red-500' : ''}`}>SSH隧道</label>
          <div className="relative">
            <div
              className={`w-full bg-bg-base border ${err.jumpServer ? 'border-red-300' : 'border-transparent'} rounded px-2.5 py-1.5 text-xs h-[30px] flex justify-between items-center cursor-pointer hover:bg-bg-card transition-colors`}
              onClick={() => store.toggleSubModal('selectAsset', true)}
            >
              <span className={store.jumpServerName ? 'text-text-1' : 'text-text-3'}>
                {store.jumpServerName || '请选择'}
              </span>
              <ChevronDown size={14} className="text-text-3" />
            </div>
            {err.jumpServer && <p className="text-red-500 text-[10px] mt-1 tracking-wide">{err.jumpServer}</p>}
          </div>
        </div>
      ) : (
        <div className="col-span-2 grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <label className={labelClass}>Host</label>
            <input type="text" className={inputClass} value={store.proxyHost} onChange={(e) => store.setField('proxyHost', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>端口</label>
            <input type="text" className={inputClass} value={store.proxyPort} onChange={(e) => store.setField('proxyPort', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>账号</label>
            <input type="text" className={inputClass} value={store.proxyUsername} onChange={(e) => store.setField('proxyUsername', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>密码</label>
            <div className="relative">
              <input
                type={showProxyPwd ? 'text' : 'password'}
                className={inputClass}
                value={store.proxyPassword}
                onChange={(e) => store.setField('proxyPassword', e.target.value)}
              />
              <button onClick={() => setShowProxyPwd(!showProxyPwd)} className="absolute right-2.5 top-1.5 text-text-3 hover:text-text-2">
                {showProxyPwd ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
