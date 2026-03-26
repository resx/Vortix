import { useT } from '../../../i18n'
import { SFontSelect, SDropdown, SNumberDropdown, SToggle } from '../SettingControls'
import { SettingGroup } from '../SettingGroup'
import { LockPasswordRow, TabCloseButtonSideRow } from './BasicSettingsRows'

export function BasicSettingsLeftSection() {
  const t = useT()

  return (
    <SettingGroup>
      <SDropdown
        k="theme"
        label="主题"
        options={[
          { value: 'auto', label: t('settings.theme.auto') },
          { value: 'light', label: t('settings.theme.light') },
          { value: 'dark', label: t('settings.theme.dark') },
        ]}
      />
      <SToggle k="middleClickCloseTab" label="中键关闭标签页" />
      <SFontSelect k="uiFontFamily" label="UI 字体" />
      <SDropdown
        k="editorLineEnding"
        label="默认换行符"
        options={[
          { value: 'lf', label: '(Linux) \\n' },
          { value: 'crlf', label: '(Windows) \\r\\n' },
          { value: 'cr', label: '(Mac) \\r' },
        ]}
        width="w-[150px]"
      />
      <SToggle k="enableAnimation" label="启用界面动画" />
      <SToggle k="showRealtimeInfo" label="显示右侧实时信息" desc="用于展示终端监控和辅助状态。" />
      <TabCloseButtonSideRow />
      <SToggle k="fontLigatures" label="启用连字" />
      <SToggle k="termZoomEnabled" label="允许终端缩放" />
      <SToggle k="tabCloseConfirm" label="关闭前确认" desc="对于 SSH 标签页关闭时要求二次确认。" />
      <SToggle k="tabFlashNotify" label="标签闪烁提醒" desc="后台标签有输出时提供视觉提醒。" />
      <SToggle k="tabMultiLine" label="标签页多行显示" desc="标签过长时允许换行显示，减少挤压。" />
    </SettingGroup>
  )
}

export function BasicSettingsRightSection() {
  return (
    <SettingGroup>
      <SDropdown
        k="language"
        label="语言"
        options={[
          { value: 'zh-CN', label: '简体中文' },
          { value: 'en', label: 'English' },
        ]}
      />
      <SDropdown
        k="updateChannel"
        label="更新通道"
        options={[
          { value: 'stable', label: '稳定版' },
          { value: 'experimental', label: '实验版' },
        ]}
        width="w-[140px]"
        desc="实验版会更早获得新功能。"
      />
      <SFontSelect k="editorFontFamily" label="编辑器字体" />
      <SNumberDropdown
        k="uiZoom"
        label="界面缩放"
        options={[
          { value: 80, label: '80%' },
          { value: 90, label: '90%' },
          { value: 100, label: '100%' },
          { value: 110, label: '110%' },
          { value: 120, label: '120%' },
          { value: 150, label: '150%' },
        ]}
        width="w-[100px]"
      />
      <SNumberDropdown
        k="editorFontSize"
        label="编辑器字号"
        options={[
          { value: 12, label: '12px' },
          { value: 13, label: '13px' },
          { value: 14, label: '14px' },
          { value: 15, label: '15px' },
          { value: 16, label: '16px' },
        ]}
        width="w-[100px]"
      />
      <SToggle k="editorWordWrap" label="编辑器自动换行" />
      <SDropdown
        k="editorTabMode"
        label="编辑器 Tab 模式"
        options={[
          { value: 'tab', label: '插入\\t' },
          { value: 'two-spaces', label: '两个空格' },
          { value: 'four-spaces', label: '四个空格' },
        ]}
        width="w-[120px]"
      />
      <SToggle k="lockOnStart" label="启动后锁屏" desc="启动应用后立即进入锁定状态。" />
      <SNumberDropdown
        k="idleLockMinutes"
        label="空闲自动锁定"
        options={[
          { value: 0, label: '关闭' },
          { value: 1, label: '1分钟' },
          { value: 5, label: '5分钟' },
          { value: 10, label: '10分钟' },
          { value: 15, label: '15分钟' },
          { value: 30, label: '30分钟' },
          { value: 60, label: '1小时' },
        ]}
      />
      <LockPasswordRow />
      <SToggle k="restoreSession" label="恢复上次会话" desc="重启后尝试恢复之前的工作标签。" />
    </SettingGroup>
  )
}
