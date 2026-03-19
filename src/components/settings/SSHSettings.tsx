import { useState } from 'react'
import { SettingRow, SettingGroup } from './SettingGroup'
import { SToggle, SDropdown, SColumnSelect, SFontSelect, SNumberInput } from './SettingControls'
import TermThemePreview from './TermThemePreview'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useTerminalProfileStore } from '../../stores/useTerminalProfileStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { getThemeById } from '../terminal/themes/index'
import { openThemeManagerWindow } from '../../lib/window'
import { AppIcon, icons } from '../icons/AppIcon'
import * as api from '../../api/client'
import type { TermThemePreset } from '../terminal/themes/index'

/** 数字微调输入 */
function NumberInput({ value, onChange, width = 'w-[60px]' }: {
  value: number; onChange: (v: number) => void; width?: string
}) {
  return (
    <input
      type="text"
      value={String(value)}
      onChange={(e) => {
        const num = parseFloat(e.target.value)
        if (!isNaN(num)) onChange(num)
        else if (e.target.value === '') onChange(0)
      }}
      className={`${width} island-control px-2 text-right text-[12px]`}
    />
  )
}

/** 光标样式选择 */
function CursorStylePicker({
  value,
  onChange,
}: {
  value: 'block' | 'underline' | 'bar'
  onChange: (v: 'block' | 'underline' | 'bar') => void
}) {
  const options: { value: 'block' | 'underline' | 'bar'; label: string }[] = [
    { value: 'block', label: 'Block' },
    { value: 'underline', label: 'Underline' },
    { value: 'bar', label: 'Bar' },
  ]
  return (
    <div className="flex items-center gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
            value === opt.value
              ? 'bg-primary/10 text-primary'
              : 'text-text-2 hover:bg-border/60'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** 入口按钮中的色块预览 */


/* ── SSH/SFTP 设置 ── */
export default function SSHSettings() {
  const [appearancePreviewMode, setAppearancePreviewMode] = useState<'light' | 'dark'>(
    () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'),
  )
  const profileStore = useTerminalProfileStore()
  const themeStore = useThemeStore()
  const profile = profileStore.getProfileById(profileStore.activeProfileId) ?? profileStore.getDefaultProfile()
  const toPreset = (id: string, fallback: 'default-light' | 'default-dark'): TermThemePreset => {
    const dynamic = themeStore.getThemeById(id)
    if (dynamic) {
      return {
        id: dynamic.id,
        name: dynamic.name,
        mode: dynamic.mode,
        theme: dynamic.terminal,
      }
    }
    return getThemeById(fallback)!
  }
  const lightPreset = toPreset(profile.colorSchemeLight, 'default-light')
  const darkPreset = toPreset(profile.colorSchemeDark, 'default-dark')
  const previewPreset = appearancePreviewMode === 'dark' ? darkPreset : lightPreset
  const lightSource = themeStore.getThemeById(profile.colorSchemeLight)?.source ?? 'builtin'
  const darkSource = themeStore.getThemeById(profile.colorSchemeDark)?.source ?? 'builtin'
  const previewSource = appearancePreviewMode === 'dark' ? darkSource : lightSource
  const previewSourceLabel = previewSource === 'builtin' ? '内置主题' : '自定义主题'
  const termLogDir = useSettingsStore((s) => s.termLogDir)
  const update = useSettingsStore((s) => s.updateSetting)
  const sftpDefaultSavePath = useSettingsStore((s) => s.sftpDefaultSavePath)

  const handleUpdateProfile = <K extends string>(key: K, value: unknown) => {
    profileStore.updateProfile(profileStore.activeProfileId, { [key]: value } as never)
  }

  return (
    <>
      {/* SSH 区域 */}
      <div className="text-[16px] font-medium text-text-1 mb-3">SSH</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6 items-start">
        {/* 左列 */}
        <SettingGroup>
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
          <SToggle k="termHighPerformance" label="GPU 加速渲染" desc="使用 WebGL 进行终端渲染，降低 CPU 占用，提升大量输出时的流畅度" />
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
              <button
                type="button"
                onClick={async () => {
                  try {
                    const selected = await api.pickDir(termLogDir || undefined)
                    if (selected) update('termLogDir', selected)
                  } catch { /* 静默 */ }
                }}
                className="island-btn w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-pointer transition-colors"
              >
                <AppIcon icon={icons.folderPlus} size={13} className="text-text-2" />
              </button>
              <input
                type="text"
                value={termLogDir}
                onChange={(e) => update('termLogDir', e.target.value)}
                placeholder="不填则关闭日志录制"
                className="island-control w-full max-w-[140px] px-2 text-[11px] placeholder-text-disabled"
              />
            </div>
          </SettingRow>
        </SettingGroup>
      </div>

      {/* 终端外观 */}
      <div className="text-[16px] font-medium text-text-1 mb-3">终端外观</div>
      <div className="mb-3 rounded-2xl border border-border/70 bg-bg-card/78 backdrop-blur-sm p-3 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-[12px] font-medium text-text-1 truncate">{previewPreset.name}</div>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-border/80 bg-bg-base text-[10px] text-text-3 shrink-0">
                {previewSourceLabel}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-border/80 bg-bg-base text-[10px] text-text-3 shrink-0">
                {appearancePreviewMode === 'dark' ? 'Dark' : 'Light'}
              </span>
            </div>
            <div className="text-[11px] text-text-3 mt-0.5">实时预览终端主题与光标表现</div>
          </div>
          <button
            type="button"
            onClick={() => { void openThemeManagerWindow() }}
            className="island-btn h-[28px] px-2.5 rounded-lg text-[11px] text-text-2 transition-colors shrink-0 inline-flex items-center gap-1"
          >
            主题管理器
            <AppIcon icon={icons.chevronRight} size={12} className="text-text-3" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-[11px] text-text-3">模式切换</div>
          <div className="inline-flex items-center rounded-lg border border-border bg-bg-base p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setAppearancePreviewMode('light')}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${appearancePreviewMode === 'light' ? 'bg-primary text-white' : 'text-text-2 hover:bg-border/70'}`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setAppearancePreviewMode('dark')}
              className={`px-2.5 py-1 rounded-md text-[11px] transition-colors ${appearancePreviewMode === 'dark' ? 'bg-primary text-white' : 'text-text-2 hover:bg-border/70'}`}
            >
              Dark
            </button>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border border-border/70">
          <TermThemePreview
            preset={previewPreset}
            cursorStyle={profile.cursorStyle}
            cursorBlink={profile.cursorBlink}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6 items-start">
        <SettingGroup>
          <SFontSelect
            label="终端字体"
            value={profile.fontFamily}
            onChangeFonts={(fonts) => handleUpdateProfile('fontFamily', fonts)}
          />
          <SettingRow label="终端字号">
            <NumberInput value={profile.fontSize} onChange={(v) => handleUpdateProfile('fontSize', v)} />
          </SettingRow>
          <SettingRow label="终端行高">
            <NumberInput value={profile.lineHeight} onChange={(v) => handleUpdateProfile('lineHeight', v)} />
          </SettingRow>
          <SToggle k="termStripeEnabled" label="护眼条纹背景" desc="交替行背景色，与行高联动" />
        </SettingGroup>
        <SettingGroup>
          <SettingRow label="终端间距">
            <NumberInput value={profile.letterSpacing} onChange={(v) => handleUpdateProfile('letterSpacing', v)} />
          </SettingRow>
          <SettingRow label="缓存行数">
            <NumberInput value={profile.scrollback} onChange={(v) => handleUpdateProfile('scrollback', v)} width="w-[80px]" />
          </SettingRow>
          <SettingRow label="光标样式">
            <CursorStylePicker value={profile.cursorStyle} onChange={(v) => handleUpdateProfile('cursorStyle', v)} />
          </SettingRow>
          <SettingRow label="光标闪烁">
            <button
              onClick={() => handleUpdateProfile('cursorBlink', !profile.cursorBlink)}
              className={`w-[36px] h-[20px] rounded-full transition-colors relative ${profile.cursorBlink ? 'bg-primary' : 'bg-border'}`}
            >
              <div className={`absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white shadow-sm transition-transform ${profile.cursorBlink ? 'left-[18px]' : 'left-[2px]'}`} />
            </button>
          </SettingRow>
        </SettingGroup>
      </div>

      {/* SFTP 区域 */}
      <div className="text-[16px] font-medium text-text-1 mb-3">SFTP</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 items-start">
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
              <button
                type="button"
                onClick={async () => {
                  try {
                    const selected = await api.pickDir(sftpDefaultSavePath || undefined)
                    if (selected) update('sftpDefaultSavePath', selected)
                  } catch { /* 静默 */ }
                }}
                className="island-btn w-[26px] h-[26px] rounded-full flex items-center justify-center cursor-pointer transition-colors"
              >
                <AppIcon icon={icons.folderPlus} size={13} className="text-text-2" />
              </button>
              <input
                type="text"
                value={sftpDefaultSavePath}
                onChange={(e) => update('sftpDefaultSavePath', e.target.value)}
                placeholder="不填则使用默认路径"
                className="island-control w-full max-w-[140px] px-2 text-[11px] placeholder-text-disabled"
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
    </>
  )
}
