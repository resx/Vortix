import * as api from '../../../api/client'
import { icons } from '../../icons/AppIcon'
import { SColumnSelect, SDropdown, SNumberInput, SToggle } from '../SettingControls'
import { SettingGroup } from '../SettingGroup'
import { DirectoryInputRow } from './SSHSettingsPrimitives'
import type { ReturnTypeSSHState } from './ssh-settings-types'

export function SSHSettingsSftpSection({ state }: { state: ReturnTypeSSHState }) {
  return (
    <>
      <div className="mb-3 text-[16px] font-medium text-text-1">SFTP</div>
      <div className="grid grid-cols-2 items-start gap-x-6 gap-y-4">
        <SettingGroup>
          <SDropdown
            k="sftpDefaultEditor"
            label="默认编辑器"
            options={[
              { value: 'builtin', label: '内置编辑器' },
              { value: 'system', label: '系统默认' },
              { value: 'custom', label: '自定义程序' },
              { value: 'vscode', label: 'VSCode' },
              { value: 'notepad++', label: 'Notepad++' },
              { value: 'sublime', label: 'Sublime Text' },
            ]}
            width="w-[150px]"
          />
          <SToggle k="sftpParentDirClick" label="双击父目录(..)返回" />
          <SDropdown
            k="sftpFileListLayout"
            label="文件列表布局"
            options={[
              { value: 'horizontal', label: '左右布局（目录树与文件列表）' },
              { value: 'vertical', label: '上下布局（目录树在上）' },
            ]}
            width="w-[240px]"
          />
          <SColumnSelect k="sftpRemoteColumns" label="远端显示列" />
          <SNumberInput k="sftpListTimeout" label="列表超时（秒）" desc="0 表示不限制" />
        </SettingGroup>

        <SettingGroup>
          <DirectoryInputRow
            label="默认下载目录"
            value={state.sftpDefaultSavePath}
            onChange={(value) => state.update('sftpDefaultSavePath', value)}
            onPick={async () => {
              try {
                const selected = await api.pickDir(state.sftpDefaultSavePath || undefined)
                if (selected) state.update('sftpDefaultSavePath', selected)
              } catch {
                // ignore
              }
            }}
            placeholder="选择下载目录"
            icon={icons.folderPlus}
          />
          <SDropdown
            k="sftpDoubleClickAction"
            label="双击文件行为"
            options={[
              { value: 'auto', label: '自动判断打开/编辑' },
              { value: 'edit', label: '始终编辑' },
              { value: 'open', label: '始终打开' },
            ]}
            width="w-[160px]"
          />
          <SToggle k="sftpShowHidden" label="显示隐藏文件" />
          <SColumnSelect k="sftpLocalColumns" label="本地显示列" />
        </SettingGroup>
      </div>
    </>
  )
}
