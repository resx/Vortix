import { useState } from 'react'
import { SettingRow, SettingGroup } from './SettingGroup'
import { SToggle, SDropdown, SNumberDropdown, SFontSelect } from './SettingControls'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Switch } from '../ui/switch'
import { AppIcon, icons } from '../icons/AppIcon'

/* ── 锁屏密码行 ── */
function LockPasswordRow() {
  const [visible, setVisible] = useState(false)
  const value = useSettingsStore((s) => s.lockPassword)
  const update = useSettingsStore((s) => s.updateSetting)
  const iconName = visible ? icons.eyeOff : icons.eye
  return (
    <SettingRow label="锁屏密码">
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="w-[26px] h-[26px] rounded-full bg-bg-base flex items-center justify-center cursor-pointer hover:bg-border transition-colors"
        >
          <AppIcon icon={iconName} size={13} className="text-text-2" />
        </button>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => update('lockPassword', e.target.value)}
          className="w-[140px] h-[26px] border border-border bg-bg-card rounded px-2 outline-none text-[12px] text-text-1"
        />
      </div>
    </SettingRow>
  )
}

/* ── 基础设置 ── */
export default function BasicSettings() {
  return (
    <>
      <div className="text-[16px] font-medium text-text-1 mb-5">基本</div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-7 items-start">
        {/* 左列 */}
        <SettingGroup>
          <SDropdown
            k="theme" label="主题"
            options={[
              { value: 'auto', label: 'auto' },
              { value: 'light', label: 'light' },
              { value: 'dark', label: 'dark' },
            ]}
          />
          <SToggle k="middleClickCloseTab" label="鼠标中键关闭选项卡" />
          <SFontSelect k="uiFontFamily" label="UI 字体" />
          <SDropdown
            k="editorLineEnding" label="编辑器换行符"
            options={[
              { value: 'lf', label: '(Linux) \\n' },
              { value: 'crlf', label: '(Windows) \\r\\n' },
              { value: 'cr', label: '(Mac) \\r' },
            ]}
            width="w-[150px]"
          />
          <SToggle k="enableAnimation" label="是否开启动画" />
          <SToggle k="showRealtimeInfo" label="显示右侧实时信息" desc="关闭后将隐藏服务器实时指标" />
          {(() => {
            const v = useSettingsStore((s) => s.tabCloseButtonLeft)
            const update = useSettingsStore((s) => s.updateSetting)
            return (
              <SettingRow label="Tab 栏关闭按钮位置" desc={v ? '靠右' : '靠左'}>
                <Switch checked={v} onCheckedChange={() => update('tabCloseButtonLeft', !v)} />
              </SettingRow>
            )
          })()}
          <SToggle k="fontLigatures" label="连体字效果" />
          <SToggle k="termZoomEnabled" label="鼠标滚轮缩放" />
          <SToggle k="tabCloseConfirm" label="标签关闭确认" desc="关闭后 SSH、终端等标签关闭时不显示确认提示弹窗" />
          <SToggle k="tabFlashNotify" label="标签闪烁提醒" desc="非当前标签页有新活动时，将触发闪烁提醒" />
          <SToggle k="tabMultiLine" label="多行显示标签卡" desc="标签卡过多时以多行方式显示，而不是横向滚动" />
        </SettingGroup>

        {/* 右列 */}
        <SettingGroup>
          <SDropdown
            k="language" label="语言"
            options={[
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en', label: 'English' },
            ]}
          />
          <SDropdown
            k="updateChannel" label="更新通道"
            options={[
              { value: 'stable', label: '稳定通道' },
              { value: 'experimental', label: '实验性通道' },
            ]}
            width="w-[140px]"
            desc="修改后需重启生效，通道之间资产不共享"
          />
          <SFontSelect k="editorFontFamily" label="编辑器字体" />
          <SNumberDropdown
            k="uiZoom" label="缩放比例"
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
            k="editorFontSize" label="编辑器字号"
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
            k="editorTabMode" label="编辑器 Tab 键模式"
            options={[
              { value: 'tab', label: '制表符\\t' },
              { value: 'two-spaces', label: '两个空格' },
              { value: 'four-spaces', label: '四个空格' },
            ]}
            width="w-[120px]"
          />
          <SToggle k="lockOnStart" label="启动锁屏" desc="启动时询问密码" />
          <SNumberDropdown
            k="idleLockMinutes" label="自动锁屏时间"
            options={[
              { value: 0, label: '关闭' },
              { value: 5, label: '5分钟' },
              { value: 15, label: '15分钟' },
              { value: 30, label: '30分钟' },
            ]}
          />
          <LockPasswordRow />
          <SToggle k="restoreSession" label="会话标签记忆" desc="(启用后，启动会自动还原上次打开的标签)" />
          <SToggle k="debugMode" label="调试模式" desc="开启后允许 F12 打开开发者工具" />
        </SettingGroup>
      </div>
    </>
  )
}
