import { useSettingsStore, type SettingsState } from '../../stores/useSettingsStore'
import { Toggle } from '../ui/switch'
import { SettingsDropdown } from '../ui/select'
import { SettingRow, SettingGroup, SettingRowPlaceholder } from './SettingGroup'
import { FolderPlus } from 'lucide-react'

/* ── 便捷封装 ── */

function SToggle({ k, label, desc }: { k: keyof SettingsState; label: string; desc?: string }) {
  const value = useSettingsStore((s) => s[k]) as boolean
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <SettingRow label={label} desc={desc}>
      <Toggle checked={value} onChange={() => update(k, !value as never)} />
    </SettingRow>
  )
}

function SDropdown({ k, label, desc, options, width = 'w-[120px]' }: {
  k: keyof SettingsState; label: string; desc?: string
  options: { value: string; label: string }[]; width?: string
}) {
  const value = useSettingsStore((s) => s[k]) as string
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <SettingRow label={label} desc={desc}>
      <SettingsDropdown value={value} options={options} onChange={(v) => update(k, v as never)} width={width} />
    </SettingRow>
  )
}

/* ── SSH/SFTP 设置 ── */
export default function SSHSettings() {
  return (
    <>
      {/* SSH 区域 */}
      <div className="text-[16px] font-medium text-[#1F2329] mb-5">SSH</div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-7 mb-10 items-stretch">
        {/* 左列 */}
        <SettingGroup>
          <SDropdown
            k="defaultAuthMethod" label="终端字体"
            options={[
              { value: 'MonoLisa', label: 'MonoLisa Variable' },
              { value: 'JetBrainsMono', label: '(内置)JetBrainsMono' },
            ]}
            width="w-[280px]"
            desc="(请选择等宽字体，否则将显示异常)"
          />
          <SToggle k="sshCompression" label="终端高亮增强" />
          <SToggle k="agentForwarding" label="SSH/SFTP 路径联动" />
          <SToggle k="rememberPassword" label="鼠标选中自动复制" />
          <SToggle k="checkUpdate" label="终端命令输入提示" />
          <SToggle k="autoSaveLog" label="SSH 历史命令" />
          <SToggle k="cloudSync" label="SSH 历史命令-储存方式" desc="储存到本地" />
          <SettingRow label="SSH 历史命令-输入提示加载数量">
            <input
              type="text"
              defaultValue="100"
              readOnly
              className="w-[60px] h-[26px] border border-[#E5E6EB] bg-white rounded px-2 text-right text-[12.5px] text-[#1F2329] outline-none"
            />
          </SettingRow>
          <SToggle k="masterPassword" label="终端护眼模式-条纹背景" />
          <SToggle k="notifyOnComplete" label="渲染模式 (高性能模式)" desc="高性能模式能够更快进行终端渲染" />
        </SettingGroup>

        {/* 右列 */}
        <SettingGroup>
          <SDropdown
            k="proxyPort" label="终端字号"
            options={[
              { value: '12', label: '12px' },
              { value: '13', label: '13px' },
              { value: '14', label: '14px' },
            ]}
            width="w-[100px]"
          />
          <SToggle k="autoReconnect" label="连接断开自动重连" />
          <SDropdown
            k="overwritePolicy" label="鼠标中键执行"
            options={[
              { value: 'none', label: '不执行' },
              { value: 'copy', label: '复制' },
              { value: 'paste', label: '粘贴' },
              { value: 'menu', label: '显示菜单' },
            ]}
            width="w-[140px]"
          />
          <SDropdown
            k="keyExchangeAlgorithm" label="鼠标右键执行"
            options={[
              { value: 'none', label: '不执行' },
              { value: 'menu', label: '显示菜单' },
              { value: 'copy-paste', label: '选中即复制，否则粘贴' },
            ]}
            width="w-[160px]"
          />
          <SToggle k="x11Forwarding" label="终端声音" />
          <SToggle k="clearClipboardOnExit" label="Ctrl+C 复制" desc="选中文本时 Ctrl+C 执行复制而非中断" />
          <SDropdown
            k="proxyMode" label="终端光标样式"
            options={[
              { value: 'block', label: '方块' },
              { value: 'underline', label: '下划线' },
              { value: 'bar', label: '竖线' },
            ]}
            width="w-[100px]"
          />
          <SToggle k="restoreSession" label="终端光标闪烁" />
          <SettingRow label="自定义终端配色">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-[26px] h-[26px] border border-[#E5E6EB] bg-white rounded flex items-center justify-center cursor-pointer hover:bg-[#E5E6EB]/50 transition-colors">
                <FolderPlus size={13} className="text-[#4E5969]" />
              </div>
              <input
                type="text"
                placeholder="不填则使用默认配色"
                className="w-[140px] h-[26px] border border-[#E5E6EB] bg-white rounded px-2 text-[11.5px] text-[#1F2329] outline-none placeholder-[#C9CDD4]"
              />
            </div>
          </SettingRow>
          <SettingRowPlaceholder />
        </SettingGroup>
      </div>

      {/* SFTP 区域 */}
      <div className="text-[16px] font-medium text-[#1F2329] mb-5">SFTP</div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-7 items-stretch">
        {/* 左列 */}
        <SettingGroup>
          <SDropdown
            k="downloadDir" label="默认编辑器"
            options={[
              { value: 'builtin', label: '内置编辑器' },
              { value: 'system', label: '系统默认' },
              { value: 'custom', label: '自定义启动命令' },
              { value: 'vscode', label: 'VSCode' },
              { value: 'notepad++', label: 'Notepad++' },
              { value: 'sublime', label: 'Sublime Text' },
            ]}
            width="w-[150px]"
          />
          <SToggle k="sshCompression" label="上级目录(..)单击打开" />
          <SDropdown
            k="proxyAddress" label="文件列表布局"
            options={[
              { value: 'horizontal', label: '左右布局(不显示本地文件列表)' },
              { value: 'vertical', label: '上下布局(显示本地文件列表)' },
            ]}
            width="w-[240px]"
          />
          <SDropdown
            k="defaultEncoding" label="远程文件显示列"
            options={[
              { value: 'default', label: '名称,修改时间,类型...' },
              { value: 'full', label: '名称,修改时间,类型,大小,权限' },
            ]}
            width="w-[220px]"
          />
          <SettingRow label="文件列表读取超时时间(秒)" desc="0为不限制">
            <input
              type="text"
              defaultValue="60"
              readOnly
              className="w-[40px] h-[26px] border border-[#E5E6EB] bg-white rounded px-2 text-right text-[12.5px] text-[#1F2329] outline-none"
            />
          </SettingRow>
        </SettingGroup>

        {/* 右列 */}
        <SettingGroup>
          <SettingRow label="默认保存路径">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-[26px] h-[26px] border border-[#E5E6EB] bg-white rounded flex items-center justify-center cursor-pointer hover:bg-[#E5E6EB]/50 transition-colors">
                <FolderPlus size={13} className="text-[#4E5969]" />
              </div>
              <input
                type="text"
                placeholder="不填则使用默认路径"
                className="w-[140px] h-[26px] border border-[#E5E6EB] bg-white rounded px-2 text-[11.5px] text-[#1F2329] outline-none placeholder-[#C9CDD4]"
              />
            </div>
          </SettingRow>
          <SDropdown
            k="overwritePolicy" label="双击打开文件逻辑"
            options={[
              { value: 'auto', label: '自动判断编辑/打开' },
              { value: 'edit', label: '总是编辑' },
              { value: 'open', label: '总是打开' },
            ]}
            width="w-[160px]"
          />
          <SToggle k="x11Forwarding" label="显示隐藏文件" />
          <SDropdown
            k="language" label="本地文件显示列"
            options={[
              { value: 'default', label: '名称,修改时间,类型...' },
              { value: 'full', label: '名称,修改时间,类型,大小,权限' },
            ]}
            width="w-[220px]"
          />
          <SettingRowPlaceholder />
        </SettingGroup>
      </div>
    </>
  )
}
