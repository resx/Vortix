import { useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import { AuthFields } from './standard-tab/AuthFields'
import { authTypes, colors, errorInputClass, inputClass, labelClass } from './standard-tab/constants'

export default function StandardTab() {
  const store = useSshConfigStore()
  const [showPassword, setShowPassword] = useState(false)
  const [showAgentTooltip, setShowAgentTooltip] = useState(false)
  const err = store.errors

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 animate-in fade-in duration-200 pb-5">
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
          <button className="text-text-3 hover:text-text-2 ml-1" onClick={() => store.setField('colorTag', null)}>
            <AppIcon icon={icons.close} size={14} />
          </button>
        </div>
      </div>

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
          <svg className="absolute right-2.5 top-2 text-text-3 pointer-events-none w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
        </div>
      </div>

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

      <div>
        <label className={labelClass}>User</label>
        <input
          type="text"
          className={inputClass}
          value={store.user}
          onChange={(e) => store.setField('user', e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>端口</label>
        <input
          type="text"
          className={inputClass}
          value={store.port}
          onChange={(e) => store.setField('port', e.target.value)}
        />
      </div>

      <div className="col-span-1 pr-4">
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {authTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => store.setField('authType', type.id)}
              className={`px-2.5 py-1 text-xs rounded-full transition-colors border ${store.authType === type.id ? 'bg-primary/5 border-primary/20 text-primary font-medium' : 'bg-bg-base border-transparent text-text-2 hover:bg-bg-hover'}`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-1 relative mt-0.5">
        <AuthFields
          store={store}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          showAgentTooltip={showAgentTooltip}
          setShowAgentTooltip={setShowAgentTooltip}
        />
      </div>

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
