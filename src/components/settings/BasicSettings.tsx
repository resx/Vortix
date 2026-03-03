import { useSettingsStore, type SettingsState } from '../../stores/useSettingsStore'
import { useAppStore } from '../../stores/useAppStore'
import { Toggle } from '../ui/switch'
import { SettingsDropdown } from '../ui/select'
import { Eye } from 'lucide-react'

/* ── 通用组件 ── */

function SettingToggle({ settingKey, label }: { settingKey: keyof SettingsState; label: string }) {
  const value = useSettingsStore((s) => s[settingKey]) as boolean
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-[#1F2329]">{label}</span>
      <Toggle checked={value} onChange={() => update(settingKey, !value as never)} />
    </div>
  )
}

function SettingToggleDesc({ settingKey, label, desc, widthClass = 'w-3/4' }: {
  settingKey: keyof SettingsState; label: string; desc: string; widthClass?: string
}) {
  const value = useSettingsStore((s) => s[settingKey]) as boolean
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <div className="flex justify-between items-center">
      <div className={`flex flex-col gap-1 ${widthClass}`}>
        <span className="text-[13px] text-[#1F2329]">{label}</span>
        <span className="text-[12px] text-[#86909C]">{desc}</span>
      </div>
      <Toggle checked={value} onChange={() => update(settingKey, !value as never)} />
    </div>
  )
}

function SettingToggleInlineLabel({ settingKey, label, inlineLabel }: {
  settingKey: keyof SettingsState; label: string; inlineLabel: string
}) {
  const value = useSettingsStore((s) => s[settingKey]) as boolean
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-[#1F2329]">{label}</span>
      <div className="flex items-center gap-3 text-[13px] text-[#4E5969]">
        {inlineLabel}
        <Toggle checked={value} onChange={() => update(settingKey, !value as never)} />
      </div>
    </div>
  )
}

function SettingToggleInlineDesc({ settingKey, label, inlineDesc }: {
  settingKey: keyof SettingsState; label: string; inlineDesc: string
}) {
  const value = useSettingsStore((s) => s[settingKey]) as boolean
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-[#1F2329]">{label}</span>
      <div className="flex items-center gap-3 text-[12px] text-[#86909C]">
        {inlineDesc}
        <Toggle checked={value} onChange={() => update(settingKey, !value as never)} />
      </div>
    </div>
  )
}

function SettingToggleWithInlineHint({ settingKey, label, hint }: {
  settingKey: keyof SettingsState; label: string; hint: string
}) {
  const value = useSettingsStore((s) => s[settingKey]) as boolean
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-1">
        <span className="text-[13px] text-[#1F2329]">{label}</span>
        <span className="text-[12px] text-[#86909C]">{hint}</span>
      </div>
      <Toggle checked={value} onChange={() => update(settingKey, !value as never)} />
    </div>
  )
}

function SettingSelect({ settingKey, label, options, width }: {
  settingKey: keyof SettingsState; label: string
  options: { value: string; label: string }[]; width?: string
}) {
  const value = useSettingsStore((s) => s[settingKey]) as string
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-[#1F2329]">{label}</span>
      <SettingsDropdown
        value={value}
        options={options}
        onChange={(v) => update(settingKey, v as never)}
        width={width}
      />
    </div>
  )
}

function SettingSelectDesc({ settingKey, label, desc, options, width }: {
  settingKey: keyof SettingsState; label: string; desc: string
  options: { value: string; label: string }[]; width?: string
}) {
  const value = useSettingsStore((s) => s[settingKey]) as string
  const update = useSettingsStore((s) => s.updateSetting)
  return (
    <div className="flex justify-between items-center">
      <div className="flex flex-col gap-1 w-3/4">
        <span className="text-[13px] text-[#1F2329]">{label}</span>
        <span className="text-[12px] text-[#86909C]">{desc}</span>
      </div>
      <SettingsDropdown
        value={value}
        options={options}
        onChange={(v) => update(settingKey, v as never)}
        width={width}
      />
    </div>
  )
}

function SettingNumberSelect({ settingKey, label, options, width }: {
  settingKey: keyof SettingsState; label: string
  options: { value: number; label: string }[]; width?: string
}) {
  const value = useSettingsStore((s) => s[settingKey]) as number
  const update = useSettingsStore((s) => s.updateSetting)
  const strOptions = options.map((o) => ({ value: String(o.value), label: o.label }))
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-[#1F2329]">{label}</span>
      <SettingsDropdown
        value={String(value)}
        options={strOptions}
        onChange={(v) => update(settingKey, Number(v) as never)}
        width={width}
      />
    </div>
  )
}

function LockPasswordRow() {
  const value = useSettingsStore((s) => s.proxyPassword)
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-1">
        <span className="text-[13px] text-[#1F2329]">锁屏密码</span>
        <span className="text-[12px] text-[#86909C]">(登录账号后，可启用锁屏)</span>
        <Eye size={14} className="ml-1 text-[#1F2329]" />
      </div>
      <input
        disabled
        type="password"
        value={value}
        className="w-[160px] h-[28px] border border-[#E5E6EB] bg-[#F7F8FA] rounded px-2 text-[13px]"
        readOnly
      />
    </div>
  )
}

function MenuVariantSelect() {
  const value = useAppStore((s) => s.menuVariant)
  const set = useAppStore((s) => s.setMenuVariant)
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-[#1F2329]">菜单风格</span>
      <SettingsDropdown
        value={value}
        options={[
          { value: 'default', label: '默认' },
          { value: 'glass', label: '毛玻璃' },
        ]}
        onChange={(v) => set(v as 'default' | 'glass')}
        width="w-[120px]"
      />
    </div>
  )
}

/* ── 主组件 ── */

export default function BasicSettings() {
  return (
    <>
      <div className="text-[15px] font-medium text-[#1F2329] mb-5">基本</div>

      <div className="grid grid-cols-2 gap-x-16 gap-y-5">
        {/* ── 左列 ── */}
        <div className="flex flex-col gap-5">
          <SettingSelect
            settingKey="proxyMode" label="主题"
            options={[
              { value: 'none', label: 'Light' },
              { value: 'http', label: 'Dark' },
              { value: 'socks5', label: 'Auto' },
            ]}
            width="w-[120px]"
          />

          <MenuVariantSelect />

          <SettingToggle settingKey="restoreSession" label="鼠标中键关闭选项卡" />

          <SettingSelect
            settingKey="defaultEncoding" label="UI 字体"
            options={[
              { value: 'UTF-8', label: 'JetBrainsMono, NotoSansSC' },
              { value: 'GBK', label: '系统字体' },
              { value: 'GB2312', label: '思源黑体' },
            ]}
            width="w-[260px]"
          />

          <SettingSelect
            settingKey="keyExchangeAlgorithm" label="编辑器换行符"
            options={[
              { value: 'auto', label: '(兼容) \\r\\n' },
              { value: 'curve25519-sha256', label: '(Windows) \\n' },
              { value: 'ecdh-sha2-nistp256', label: '(Linux) \\r' },
            ]}
            width="w-[150px]"
          />

          <SettingToggle settingKey="checkUpdate" label="是否开启动画" />

          <SettingToggleDesc
            settingKey="autoSaveLog" label="显示右侧实时信息"
            desc="关闭后将隐藏服务器实时指标"
          />

          <SettingToggleInlineLabel
            settingKey="sshCompression" label="Tab 栏关闭按钮位置"
            inlineLabel="靠左"
          />

          <SettingToggle settingKey="agentForwarding" label="连体字效果" />
          <SettingToggle settingKey="x11Forwarding" label="鼠标滚轮缩放" />

          <SettingToggleDesc
            settingKey="notifyOnComplete" label="标签关闭确认"
            desc="关闭后 SSH、终端等标签关闭时不显示确认提示弹窗"
            widthClass="w-[85%]"
          />

          <SettingToggleDesc
            settingKey="rememberPassword" label="标签闪烁提醒"
            desc="非当前标签页有新活动时，将触发闪烁提醒"
            widthClass="w-[85%]"
          />

          <SettingToggleDesc
            settingKey="masterPassword" label="多行显示标签卡"
            desc="标签卡过多时以多行方式显示，而不是横向滚动"
            widthClass="w-[85%]"
          />
        </div>

        {/* ── 右列 ── */}
        <div className="flex flex-col gap-5">
          <SettingSelect
            settingKey="language" label="语言"
            options={[
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en', label: 'English' },
              { value: 'ja', label: '日本語' },
            ]}
            width="w-[120px]"
          />

          <SettingSelectDesc
            settingKey="overwritePolicy" label="更新通道"
            desc="修改后需重启生效，通道之间资产不共享"
            options={[
              { value: 'ask', label: '稳定通道' },
              { value: 'overwrite', label: '实验性通道' },
            ]}
            width="w-[140px]"
          />

          <SettingSelect
            settingKey="defaultAuthMethod" label="编辑器字体"
            options={[
              { value: 'password', label: 'MonoLisa Variable' },
              { value: 'key', label: 'JetBrainsMono' },
              { value: 'password+key', label: '思源黑体' },
            ]}
            width="w-[240px]"
          />

          <SettingNumberSelect
            settingKey="connectionTimeout" label="缩放比例"
            options={[
              { value: 90, label: '90%' }, { value: 100, label: '100%' },
              { value: 110, label: '110%' }, { value: 115, label: '115%' },
              { value: 125, label: '125%' }, { value: 135, label: '135%' },
              { value: 150, label: '150%' },
            ]}
            width="w-[100px]"
          />

          <SettingNumberSelect
            settingKey="heartbeatInterval" label="编辑器字号"
            options={[
              { value: 10, label: '10px' }, { value: 12, label: '12px' },
              { value: 13, label: '13px' }, { value: 14, label: '14px' },
              { value: 15, label: '15px' }, { value: 16, label: '16px' },
            ]}
            width="w-[100px]"
          />

          <SettingToggle settingKey="autoReconnect" label="编辑器自动换行" />

          <SettingSelect
            settingKey="downloadDir" label="编辑器 Tab 键模式"
            options={[
              { value: '~/Downloads', label: '制表符\\t' },
              { value: 'two-spaces', label: '两个空格' },
              { value: 'four-spaces', label: '四个空格' },
            ]}
            width="w-[120px]"
          />

          <SettingToggleInlineDesc
            settingKey="clearClipboardOnExit" label="启动锁屏"
            inlineDesc="启动时询问密码，登录账号后启用"
          />

          <SettingNumberSelect
            settingKey="idleLockMinutes" label="自动锁屏时间"
            options={[
              { value: 0, label: '关闭' }, { value: 5, label: '5分钟' },
              { value: 15, label: '15分钟' }, { value: 30, label: '30分钟' },
            ]}
            width="w-[100px]"
          />

          <LockPasswordRow />

          <SettingToggleWithInlineHint
            settingKey="cloudSync" label="会话标签记忆"
            hint="(启用后，启动会自动还原上次打开的标签)"
          />

          <SettingToggleWithInlineHint
            settingKey="autoSaveLog" label="显示会员标志"
            hint="(关闭后，付费用户将不会在顶部显示会员图标)"
          />
        </div>
      </div>
    </>
  )
}
