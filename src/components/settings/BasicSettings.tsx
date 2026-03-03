import { useState } from 'react'
import { SettingRow, SettingGroup } from './SettingGroup'
import { SToggle, SDropdown, SNumberDropdown, SFontSelect } from './SettingControls'
import { Eye, EyeOff } from 'lucide-react'

/* ── 锁屏密码行 ── */
function LockPasswordRow() {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye
  return (
    <SettingRow label="锁屏密码" desc="(登录账号后，可启用锁屏)">
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="w-[26px] h-[26px] rounded-full bg-[#F2F3F5] flex items-center justify-center cursor-pointer hover:bg-[#E5E6EB] transition-colors"
        >
          <Icon size={13} className="text-[#4E5969]" />
        </button>
        <input
          disabled
          type={visible ? 'text' : 'password'}
          className="w-[140px] h-[26px] border border-[#E5E6EB] bg-white rounded px-2 outline-none text-[12px]"
        />
      </div>
    </SettingRow>
  )
}

/* ── 基础设置 ── */
export default function BasicSettings() {
  return (
    <>
      <div className="text-[16px] font-medium text-[#1F2329] mb-5">基本</div>
      <div className="grid grid-cols-2 gap-x-10 gap-y-7 items-start">
        {/* 左列 */}
        <SettingGroup>
          <SDropdown
            k="proxyMode" label="主题"
            options={[
              { value: 'auto', label: 'auto' },
              { value: 'light', label: 'light' },
              { value: 'dark', label: 'dark' },
            ]}
          />
          <SToggle k="checkUpdate" label="鼠标中键关闭选项卡" />
          <SFontSelect k="defaultEncoding" label="UI 字体" />
          <SDropdown
            k="keyExchangeAlgorithm" label="编辑器换行符"
            options={[
              { value: 'crlf', label: '(兼容) \\r\\n' },
              { value: 'lf', label: '(Windows) \\n' },
              { value: 'cr', label: '(Linux) \\r' },
            ]}
            width="w-[150px]"
          />
          <SToggle k="restoreSession" label="是否开启动画" />
          <SToggle k="sshCompression" label="显示右侧实时信息" desc="关闭后将隐藏服务器实时指标" />
          <SToggle k="agentForwarding" label="Tab 栏关闭按钮位置" desc="靠左" />
          <SToggle k="x11Forwarding" label="连体字效果" />
          <SToggle k="notifyOnComplete" label="鼠标滚轮缩放" />
          <SToggle k="rememberPassword" label="标签关闭确认" desc="关闭后 SSH、终端等标签关闭时不显示确认提示弹窗" />
          <SToggle k="masterPassword" label="标签闪烁提醒" desc="非当前标签页有新活动时，将触发闪烁提醒" />
          <SToggle k="autoReconnect" label="多行显示标签卡" desc="标签卡过多时以多行方式显示，而不是横向滚动" />
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
            k="overwritePolicy" label="更新通道"
            options={[
              { value: 'stable', label: '稳定通道' },
              { value: 'experimental', label: '实验性通道' },
            ]}
            width="w-[140px]"
            desc="修改后需重启生效，通道之间资产不共享"
          />
          <SFontSelect k="defaultAuthMethod" label="编辑器字体" />
          <SDropdown
            k="proxyAddress" label="缩放比例"
            options={[
              { value: '90', label: '90%' },
              { value: '100', label: '100%' },
              { value: '110', label: '110%' },
            ]}
            width="w-[100px]"
          />
          <SDropdown
            k="proxyPort" label="编辑器字号"
            options={[
              { value: '12', label: '12px' },
              { value: '14', label: '14px' },
              { value: '16', label: '16px' },
            ]}
            width="w-[100px]"
          />
          <SToggle k="autoSaveLog" label="编辑器自动换行" />
          <SDropdown
            k="downloadDir" label="编辑器 Tab 键模式"
            options={[
              { value: 'tab', label: '制表符\\t' },
              { value: 'two-spaces', label: '两个空格' },
              { value: 'four-spaces', label: '四个空格' },
            ]}
            width="w-[120px]"
          />
          <SToggle k="clearClipboardOnExit" label="启动锁屏" desc="启动时询问密码，登录账号后启用" />
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
          <SToggle k="cloudSync" label="会话标签记忆" desc="(启用后，启动会自动还原上次打开的标签)" />
          <SToggle k="autoSaveLog" label="显示会员标志" desc="(关闭后，付费用户将不会在顶部显示会员图标)" />
        </SettingGroup>
      </div>
    </>
  )
}
