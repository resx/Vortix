import { useState } from 'react'
import { Eye, EyeOff, LocateFixed } from 'lucide-react'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'

export default function ImportKeyModal() {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const [name, setName] = useState('')
  const [keyContent, setKeyContent] = useState('')
  const [errors] = useState<Record<string, string>>({ name: 'name is a required field', privateKey: 'privateKey is a required field' })

  const canSave = name.trim() && keyContent.trim()

  return (
    <IslandModal
      title="导入私钥"
      isOpen
      onClose={() => toggleSubModal('importKey', false)}
      width="max-w-lg"
      padding="p-4"
      footer={
        <>
          <div className="space-x-2">
            <button className="text-xs text-teal-500 hover:text-teal-600 bg-teal-50 px-2 py-1 rounded">生成新的</button>
            <button className="text-xs text-text-3 hover:text-text-2 px-2 py-1">复制公钥</button>
            <button className="text-xs text-text-3 hover:text-text-2 px-2 py-1">下载</button>
          </div>
          <div className="space-x-3">
            <button onClick={() => toggleSubModal('importKey', false)} className="text-xs text-orange-500 hover:text-orange-600">取消</button>
            <button className={`text-xs font-medium ${canSave ? 'text-primary hover:opacity-80' : 'text-primary/40 cursor-not-allowed'}`}>保存</button>
          </div>
        </>
      }
    >
      <div className="text-[11px] text-text-3 mb-4">可直接将私钥文件拖拽进此区域</div>
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
            <input
              type="text"
              className="w-full bg-transparent text-xs outline-none placeholder-text-3 text-text-1 pb-0.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {!name.trim() && <p className="text-red-500 text-[10px]">{errors.name}</p>}
          </div>
        </div>

        {/* 私钥文件 */}
        <div className="flex items-start">
          <div className="w-7 pt-1.5 text-text-3 flex justify-center">
            <div className="w-3.5 h-3.5 border border-current rounded-full relative">
              <div className="absolute top-[2px] left-1/2 -translate-x-1/2 w-0.5 h-1 bg-current" />
              <div className="absolute bottom-[2px] left-1/2 -translate-x-1/2 w-0.5 h-1 bg-current" />
            </div>
          </div>
          <div className="flex-1 border-b border-border pb-1 relative">
            <label className="text-xs text-text-2 block mb-0.5">私钥文件</label>
            <input type="text" placeholder="选择私钥文件，自动填入私钥" className="w-full bg-transparent text-xs outline-none placeholder-text-3 text-text-1 pb-0.5" />
            <button className="absolute right-0 bottom-1.5 text-text-3 hover:text-text-2"><LocateFixed size={14} /></button>
          </div>
        </div>

        {/* 私钥内容 */}
        <div className="flex items-start">
          <div className="w-7 pt-1.5 text-red-500 flex justify-center">
            <div className="w-3.5 h-3.5 border border-current rounded relative">
              <div className="absolute top-1 left-1 w-1.5 h-[1px] bg-current" />
              <div className="absolute top-2 left-1 w-1 h-[1px] bg-current" />
            </div>
          </div>
          <div className={`flex-1 border-b pb-1.5 ${!keyContent.trim() ? 'border-red-300' : 'border-border'}`}>
            <label className={`text-xs block mb-0.5 ${!keyContent.trim() ? 'text-red-500' : 'text-text-2'}`}>私钥内容</label>
            <textarea
              className="w-full h-12 bg-transparent text-xs outline-none resize-none text-text-1"
              value={keyContent}
              onChange={(e) => setKeyContent(e.target.value)}
            />
            {!keyContent.trim() && <p className="text-red-500 text-[10px] mt-0.5">{errors.privateKey}</p>}
          </div>
        </div>
      </div>
    </IslandModal>
  )
}
