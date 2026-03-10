import { useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'

export default function ManagePresetModal() {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const canSave = name.trim() && username.trim() && password.trim()

  return (
    <IslandModal
      title="预设账号密码管理"
      isOpen
      onClose={() => toggleSubModal('managePreset', false)}
      width="max-w-lg"
      padding="p-4"
      footer={
        <div className="w-full flex justify-end space-x-3">
          <button onClick={() => toggleSubModal('managePreset', false)} className="text-xs text-orange-500 hover:text-orange-600">取消</button>
          <button className={`text-xs font-medium ${canSave ? 'text-primary hover:opacity-80' : 'text-primary/40 cursor-not-allowed'}`}>保存</button>
        </div>
      }
    >
      <div className="text-[11px] text-text-3 mb-5">预存的账号密码对，可在 SSH 配置中引用</div>
      <div className="space-y-4">
        {/* 名称 */}
        <div className="flex items-start">
          <div className="w-7 pt-1.5 text-red-500 flex justify-center">
            <div className="w-3.5 h-2.5 border border-current rounded-[2px] relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-[1px] bg-current" />
            </div>
          </div>
          <div className={`flex-1 border-b pb-1.5 ${!name.trim() ? 'border-red-300' : 'border-border'}`}>
            <label className={`text-xs block mb-0.5 ${!name.trim() ? 'text-red-500' : 'text-text-2'}`}>名称</label>
            <input type="text" className="w-full bg-transparent text-xs outline-none placeholder-text-3 text-text-1 pb-0.5" value={name} onChange={(e) => setName(e.target.value)} />
            {!name.trim() && <p className="text-red-500 text-[10px]">name is a required field</p>}
          </div>
        </div>

        {/* 用户名 */}
        <div className="flex items-start">
          <div className="w-7 pt-1.5 text-red-500 flex justify-center">
            <div className="w-3 h-3 border-2 border-current rounded-full relative">
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 border-t-2 border-current rounded-t-full" />
            </div>
          </div>
          <div className={`flex-1 border-b pb-1.5 ${!username.trim() ? 'border-red-300' : 'border-border'}`}>
            <label className={`text-xs block mb-0.5 ${!username.trim() ? 'text-red-500' : 'text-text-2'}`}>用户名</label>
            <input type="text" className="w-full bg-transparent text-xs outline-none placeholder-text-3 text-text-1 pb-0.5" value={username} onChange={(e) => setUsername(e.target.value)} />
            {!username.trim() && <p className="text-red-500 text-[10px]">username is a required field</p>}
          </div>
        </div>

        {/* 密码 */}
        <div className="flex items-start">
          <div className="w-7 pt-1.5 text-red-500 flex justify-center">
            <div className="w-3 h-3.5 border border-current rounded-t-full relative border-b-0">
              <div className="absolute bottom-[-3px] left-[-3px] right-[-3px] h-2 border border-current rounded-[2px]" />
            </div>
          </div>
          <div className={`flex-1 border-b pb-1.5 relative ${!password.trim() ? 'border-red-300' : 'border-border'}`}>
            <label className={`text-xs block mb-0.5 ${!password.trim() ? 'text-red-500' : 'text-text-2'}`}>密码</label>
            <input
              type={showPwd ? 'text' : 'password'}
              className="w-full bg-transparent text-xs outline-none placeholder-text-3 text-text-1 pb-0.5 pr-6"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {!password.trim() && <p className="text-red-500 text-[10px]">password is a required field</p>}
            <button onClick={() => setShowPwd(!showPwd)} className="absolute right-0 top-4 text-text-1">
              {showPwd ? <AppIcon icon={icons.eyeOff} size={16} /> : <AppIcon icon={icons.eye} size={16} />}
            </button>
          </div>
        </div>
      </div>
    </IslandModal>
  )
}
