import { SettingRow, SettingGroup } from './SettingGroup'
import { SToggle, SDropdown, SNumberDropdown, SColumnSelect, SFontSelect, SNumberInput } from './SettingControls'
import { FolderPlus } from 'lucide-react'

/* ── SSH/SFTP 设置 ── */
export default function SSHSettings() {
  return (
    <>
      {/* SSH 区域 */}
      <div className="text-[16px] font-medium text-text-1 mb-5">SSH</div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-7 mb-10 items-start">
        {/* 左列 */}
        <SettingGroup>
          <SFontSelect k="termFontFamily" label="终端字体" desc="(请选择等宽字体，否则将显示异常)" />
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
              className="w-[60px] h-[26px] border border-border bg-bg-card rounded px-2 text-right text-[12px] text-text-1 outline-none"
            />
          </SettingRow>
          <SToggle k="masterPassword" label="终端护眼模式-条纹背景" />
          <SToggle k="notifyOnComplete" label="渲染模式 (高性能模式)" desc="高性能模式能够更快进行终端渲染" />
        </SettingGroup>

        {/* 右列 */}
        <SettingGroup>
          <SNumberDropdown
            k="termFontSize" label="终端字号"
            options={[
              { value: 12, label: '12px' },
              { value: 13, label: '13px' },
              { value: 14, label: '14px' },
              { value: 15, label: '15px' },
              { value: 16, label: '16px' },
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
              { value: 'copy-paste', label: '选中即复制，否则粘贴' },
            ]}
            width="w-[180px]"
          />
          <SDropdown
            k="keyExchangeAlgorithm" label="鼠标右键执行"
            options={[
              { value: 'none', label: '不执行' },
              { value: 'copy', label: '复制' },
              { value: 'paste', label: '粘贴' },
              { value: 'menu', label: '显示菜单' },
              { value: 'copy-paste', label: '选中即复制，否则粘贴' },
            ]}
            width="w-[180px]"
          />
          <SToggle k="x11Forwarding" label="终端声音" />
          <SToggle k="clearClipboardOnExit" label="Ctrl+V 粘贴" desc="将拦截 Ctrl+V 作为粘贴快捷键" />
          <SNumberInput k="termLineHeight" label="终端行高" desc="基准值为 1" />
          <SNumberInput k="termLetterSpacing" label="终端间距" />
          <SettingRow label="终端最大缓存行数">
            <input
              type="text"
              defaultValue="1000"
              readOnly
              className="w-[60px] h-[26px] border border-border bg-bg-card rounded px-2 text-right text-[12px] text-text-1 outline-none"
            />
          </SettingRow>
          <SettingRow label="日志存储目录">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors">
                <FolderPlus size={13} className="text-text-2" />
              </div>
              <input
                type="text"
                placeholder="不填则关闭日志录制"
                className="w-[140px] h-[26px] border border-border bg-bg-card rounded px-2 text-[11px] text-text-1 outline-none placeholder-text-disabled"
              />
            </div>
          </SettingRow>
        </SettingGroup>
      </div>

      {/* SFTP 区域 */}
      <div className="text-[16px] font-medium text-text-1 mb-5">SFTP</div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-7 items-start">
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
          <SColumnSelect label="远程文件显示列" />
          <SettingRow label="文件列表读取超时时间(秒)" desc="0为不限制">
            <input
              type="text"
              defaultValue="60"
              readOnly
              className="w-[40px] h-[26px] border border-border bg-bg-card rounded px-2 text-right text-[12px] text-text-1 outline-none"
            />
          </SettingRow>
        </SettingGroup>

        {/* 右列 */}
        <SettingGroup>
          <SettingRow label="默认保存路径">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors">
                <FolderPlus size={13} className="text-text-2" />
              </div>
              <input
                type="text"
                placeholder="不填则使用默认路径"
                className="w-[140px] h-[26px] border border-border bg-bg-card rounded px-2 text-[11px] text-text-1 outline-none placeholder-text-disabled"
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
          <SColumnSelect label="本地文件显示列" />
        </SettingGroup>
      </div>
    </>
  )
}
