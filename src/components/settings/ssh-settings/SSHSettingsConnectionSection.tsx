import * as api from '../../../api/client'
import { icons } from '../../icons/AppIcon'
import { SDropdown, SNumberInput, SToggle } from '../SettingControls'
import { SettingGroup } from '../SettingGroup'
import { DirectoryInputRow } from './SSHSettingsPrimitives'
import type { ReturnTypeSSHState } from './ssh-settings-types'

export function SSHSettingsConnectionSection({ state }: { state: ReturnTypeSSHState }) {
  return (
    <>
      <div className="mb-3 text-[16px] font-medium text-text-1">SSH</div>
      <div className="mb-6 grid grid-cols-2 items-start gap-x-6 gap-y-4">
        <SettingGroup>
          <SToggle
            k="termHighlightEnhance"
            label="启用终端关键词高亮"
            desc="该开关同时控制顶部规则管理器和终端内的流式高亮渲染。"
          />
          <SToggle k="sshSftpPathSync" label="SSH/SFTP 路径同步" />
          <SToggle k="termSelectAutoCopy" label="选中自动复制" />
          <SToggle k="sshHistoryEnabled" label="启用 SSH 历史" />
          <SDropdown
            k="sshHistoryStorage"
            label="SSH 历史 - 存储位置"
            options={[
              { value: 'local', label: '仅本地保存' },
              { value: 'cloud', label: '云端同步' },
            ]}
            width="w-[130px]"
          />
          <SNumberInput k="sshHistoryLoadCount" label="SSH 历史 - 加载数量" />
          <SToggle k="termHighPerformance" label="GPU 高性能模式" desc="启用 WebGL 渲染，降低 CPU 占用，但可能带来兼容性问题。" />
        </SettingGroup>

        <SettingGroup>
          <SToggle k="autoReconnect" label="自动重连" />
          <SDropdown
            k="termMiddleClickAction"
            label="中键操作"
            options={[
              { value: 'none', label: '无操作' },
              { value: 'copy', label: '复制' },
              { value: 'paste', label: '粘贴' },
              { value: 'menu', label: '上下文菜单' },
              { value: 'copy-paste', label: '有选区复制，否则粘贴' },
            ]}
            width="w-[180px]"
          />
          <SDropdown
            k="termRightClickAction"
            label="右键操作"
            options={[
              { value: 'none', label: '无操作' },
              { value: 'copy', label: '复制' },
              { value: 'paste', label: '粘贴' },
              { value: 'menu', label: '上下文菜单' },
              { value: 'copy-paste', label: '有选区复制，否则粘贴' },
            ]}
            width="w-[180px]"
          />
          <SToggle k="termSound" label="终端提示音" />
          <SToggle k="termCtrlVPaste" label="Ctrl+V 粘贴" desc="关闭后 Ctrl+V 仍交给远端程序自行处理。" />
          <DirectoryInputRow
            label="终端日志目录"
            value={state.termLogDir}
            onChange={(value) => state.update('termLogDir', value)}
            onPick={async () => {
              try {
                const selected = await api.pickDir(state.termLogDir || undefined)
                if (selected) state.update('termLogDir', selected)
              } catch {
                // ignore
              }
            }}
            placeholder="选择日志目录"
            icon={icons.folderPlus}
          />
        </SettingGroup>
      </div>
    </>
  )
}
