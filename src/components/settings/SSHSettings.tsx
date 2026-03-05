import { useState } from 'react'
import { SettingRow, SettingGroup } from './SettingGroup'
import { SToggle, SDropdown, SNumberDropdown, SColumnSelect, SFontSelect, SNumberInput, STextInput } from './SettingControls'
import TermThemePanel from './TermThemePanel'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { getThemeById } from '../terminal/themes/index'
import { FolderPlus, ChevronRight } from 'lucide-react'
import type { TermThemePreset } from '../terminal/themes/index'

/** 入口按钮中的色块预览 */
function PreviewSwatches({ preset }: { preset: TermThemePreset }) {
  const t = preset.theme
  const colors = [t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan]
  return (
    <div
      className="flex items-center gap-[3px] rounded-[4px] px-1.5 py-[3px]"
      style={{ backgroundColor: t.background }}
    >
      <span className="text-[9px] leading-none font-mono mr-0.5 select-none" style={{ color: t.foreground }}>Aa</span>
      {colors.map((c, i) => (
        <div key={i} className="w-[10px] h-[10px] rounded-full shrink-0" style={{ backgroundColor: c }} />
      ))}
    </div>
  )
}

/* ── SSH/SFTP 设置 ── */
export default function SSHSettings() {
  const [themePanelOpen, setThemePanelOpen] = useState(false)
  const profileStore = useTerminalProfileStore()
  const profile = profileStore.getProfileById(profileStore.activeProfileId) ?? profileStore.getDefaultProfile()
  const lightPreset = getThemeById(profile.colorSchemeLight) ?? getThemeById('default-light')!
  const darkPreset = getThemeById(profile.colorSchemeDark) ?? getThemeById('default-dark')!
  const termLogDir = useSettingsStore((s) => s.termLogDir)
  const update = useSettingsStore((s) => s.updateSetting)
  const sftpDefaultSavePath = useSettingsStore((s) => s.sftpDefaultSavePath)

  return (
    <>
      {/* SSH 区域 */}
      <div className="text-[16px] font-medium text-text-1 mb-5">SSH</div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-7 mb-10 items-start">
        {/* 左列 */}
        <SettingGroup>
          <SettingRow label="终端主题">
            <button
              onClick={() => setThemePanelOpen(true)}
              className="flex items-center gap-1.5 cursor-pointer text-text-2 hover:text-text-1 transition-colors text-[13px] outline-none"
            >
              <span className="text-[11px] text-text-2 mr-1">{profile.name}</span>
              <PreviewSwatches preset={lightPreset} />
              <span className="text-text-3 text-[11px]">/</span>
              <PreviewSwatches preset={darkPreset} />
              <ChevronRight size={14} className="shrink-0 text-text-3" />
            </button>
          </SettingRow>
          <SToggle k="termHighlightEnhance" label="终端高亮增强" />
          <SToggle k="sshSftpPathSync" label="SSH/SFTP 路径联动" />
          <SToggle k="termSelectAutoCopy" label="鼠标选中自动复制" />
          <SToggle k="termCommandHint" label="终端命令输入提示" />
          <SToggle k="sshHistoryEnabled" label="SSH 历史命令" />
          <SDropdown
            k="sshHistoryStorage" label="SSH 历史命令-储存方式"
            options={[
              { value: 'local', label: '储存到本地' },
              { value: 'cloud', label: '云端同步' },
            ]}
            width="w-[130px]"
          />
          <SNumberInput k="sshHistoryLoadCount" label="SSH 历史命令-输入提示加载数量" />
          <SToggle k="termHighPerformance" label="渲染模式 (高性能模式)" desc="高性能模式能够更快进行终端渲染" />
        </SettingGroup>

        {/* 右列 */}
        <SettingGroup>
          <SToggle k="autoReconnect" label="连接断开自动重连" />
          <SDropdown
            k="termMiddleClickAction" label="鼠标中键执行"
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
            k="termRightClickAction" label="鼠标右键执行"
            options={[
              { value: 'none', label: '不执行' },
              { value: 'copy', label: '复制' },
              { value: 'paste', label: '粘贴' },
              { value: 'menu', label: '显示菜单' },
              { value: 'copy-paste', label: '选中即复制，否则粘贴' },
            ]}
            width="w-[180px]"
          />
          <SToggle k="termSound" label="终端声音" />
          <SToggle k="termCtrlVPaste" label="Ctrl+V 粘贴" desc="将拦截 Ctrl+V 作为粘贴快捷键" />
          <SettingRow label="日志存储目录">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors">
                <FolderPlus size={13} className="text-text-2" />
              </div>
              <input
                type="text"
                value={termLogDir}
                onChange={(e) => update('termLogDir', e.target.value)}
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
            k="sftpDefaultEditor" label="默认编辑器"
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
          <SToggle k="sftpParentDirClick" label="上级目录(..)单击打开" />
          <SDropdown
            k="sftpFileListLayout" label="文件列表布局"
            options={[
              { value: 'horizontal', label: '左右布局(不显示本地文件列表)' },
              { value: 'vertical', label: '上下布局(显示本地文件列表)' },
            ]}
            width="w-[240px]"
          />
          <SColumnSelect k="sftpRemoteColumns" label="远程文件显示列" />
          <SNumberInput k="sftpListTimeout" label="文件列表读取超时时间(秒)" desc="0为不限制" />
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
                value={sftpDefaultSavePath}
                onChange={(e) => update('sftpDefaultSavePath', e.target.value)}
                placeholder="不填则使用默认路径"
                className="w-[140px] h-[26px] border border-border bg-bg-card rounded px-2 text-[11px] text-text-1 outline-none placeholder-text-disabled"
              />
            </div>
          </SettingRow>
          <SDropdown
            k="sftpDoubleClickAction" label="双击打开文件逻辑"
            options={[
              { value: 'auto', label: '自动判断编辑/打开' },
              { value: 'edit', label: '总是编辑' },
              { value: 'open', label: '总是打开' },
            ]}
            width="w-[160px]"
          />
          <SToggle k="sftpShowHidden" label="显示隐藏文件" />
          <SColumnSelect k="sftpLocalColumns" label="本地文件显示列" />
        </SettingGroup>
      </div>

      {/* 终端主题配置面板 */}
      <TermThemePanel isOpen={themePanelOpen} onClose={() => setThemePanelOpen(false)} />
    </>
  )
}