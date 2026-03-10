import { AppIcon, icons } from '../../icons/AppIcon'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import { MOCK_PRESET_ACCOUNTS } from '../../../data/ssh-config-mock'

export default function SelectPresetModal() {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)

  return (
    <IslandModal
      title="请选择预设账号密码"
      isOpen
      onClose={() => toggleSubModal('selectPreset', false)}
      width="max-w-lg"
      padding="p-4"
      footer={
        <div className="w-full flex justify-end space-x-3">
          <button onClick={() => toggleSubModal('selectPreset', false)} className="text-xs text-orange-500 hover:text-orange-600">取消</button>
          <button onClick={() => { toggleSubModal('selectPreset', false); toggleSubModal('managePreset', true) }} className="text-xs text-teal-500 hover:text-teal-600 font-medium">新建</button>
        </div>
      }
    >
      <div className="text-[11px] text-text-3 mb-2">双击或者回车选择预设账号密码</div>
      <table className="w-full text-xs text-left mb-6 border-b border-border/50">
        <thead className="text-text-3">
          <tr>
            <th className="px-3 py-2 font-normal hover:bg-bg-hover">名称 <AppIcon icon={icons.chevronDown} size={12} className="ml-0.5 opacity-50 inline" /></th>
            <th className="px-3 py-2 font-normal hover:bg-bg-hover">用户名 <AppIcon icon={icons.chevronDown} size={12} className="ml-0.5 opacity-50 inline" /></th>
            <th className="px-3 py-2 font-normal hover:bg-bg-hover">更新时间 <AppIcon icon={icons.chevronDown} size={12} className="ml-0.5 opacity-50 inline" /></th>
          </tr>
        </thead>
      </table>
      {MOCK_PRESET_ACCOUNTS.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-text-3">
          <AppIcon icon={icons.cloudSun} size={52} className="mb-3" />
          <p className="text-xs">暂无数据</p>
        </div>
      )}
    </IslandModal>
  )
}
