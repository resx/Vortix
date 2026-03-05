import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import { MOCK_PRIVATE_KEYS } from '../../../data/ssh-config-mock'

export default function SelectKeyModal() {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const setField = useSshConfigStore((s) => s.setField)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const handleSelect = (id: string) => {
    setSelectedId(id)
  }

  const handleConfirm = () => {
    if (selectedId) {
      const key = MOCK_PRIVATE_KEYS.find((k) => k.id === selectedId)
      if (key) setField('privateKeyId', key.name)
    }
    toggleSubModal('selectKey', false)
  }

  return (
    <IslandModal
      title="请选择私钥"
      isOpen
      onClose={() => toggleSubModal('selectKey', false)}
      width="max-w-lg"
      padding="p-4"
      footer={
        <>
          <div className="text-[11px] text-text-3">双击或者回车选择私钥</div>
          <div className="space-x-3">
            <button onClick={() => toggleSubModal('selectKey', false)} className="text-xs text-orange-500 hover:text-orange-600">取消</button>
            <button onClick={() => { toggleSubModal('selectKey', false); toggleSubModal('importKey', true) }} className="text-xs text-teal-500 hover:text-teal-600 font-medium">新建</button>
          </div>
        </>
      }
    >
      <div className="text-[11px] text-text-3 mb-2">双击或者回车选择私钥</div>
      <div className="border border-border/50 rounded overflow-hidden bg-bg-subtle/30">
        <table className="w-full text-xs text-left">
          <thead className="text-text-3 border-b border-border/50">
            <tr>
              <th className="px-3 py-2 font-normal hover:bg-bg-hover">名称 <ChevronDown size={12} className="ml-0.5 opacity-50 inline" /></th>
              <th className="px-3 py-2 font-normal hover:bg-bg-hover">文件名 <ChevronDown size={12} className="ml-0.5 opacity-50 inline" /></th>
              <th className="px-3 py-2 font-normal hover:bg-bg-hover">类型 <ChevronDown size={12} className="ml-0.5 opacity-50 inline" /></th>
              <th className="px-3 py-2 font-normal hover:bg-bg-hover">更新时间 <ChevronDown size={12} className="ml-0.5 opacity-50 inline" /></th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PRIVATE_KEYS.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-border/30 hover:bg-primary/5 cursor-pointer ${selectedId === row.id ? 'bg-primary/5' : ''}`}
                onClick={() => handleSelect(row.id)}
                onDoubleClick={() => { handleSelect(row.id); handleConfirm() }}
              >
                <td className="px-3 py-2 text-text-1">{row.name}</td>
                <td className="px-3 py-2 text-text-2">{row.fileName}</td>
                <td className="px-3 py-2 text-text-2">{row.type}</td>
                <td className="px-3 py-2 text-text-3">{row.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </IslandModal>
  )
}
