import { memo } from 'react'
import HoverTooltip from '../../ui/hover-tooltip'
import { chevronSvg, ENCODINGS, inputClass, labelClass, selectClass, TERM_TYPES } from './constants'
import type { AdvancedTabProps } from './types'

const CheckItem = memo(function CheckItem({
  label,
  tooltip,
  checked,
  onChange,
  disabled,
}: {
  label: string
  tooltip?: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  const inner = (
    <label className={`flex items-center gap-1.5 text-xs cursor-pointer select-none ${disabled ? 'text-text-disabled cursor-not-allowed' : 'text-text-1'}`}>
      <input
        type="checkbox"
        className={`accent-primary w-3 h-3 ${disabled ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
        checked={checked}
        onChange={disabled ? undefined : onChange}
        readOnly={disabled}
      />
      {label}
    </label>
  )
  return tooltip ? <HoverTooltip text={tooltip} disabled={disabled && !tooltip}>{inner}</HoverTooltip> : inner
})

export const AdvancedTabContent = memo(function AdvancedTabContent({ adv, updateAdv }: AdvancedTabProps) {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-200 pb-6">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6 px-1">
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="启用 SFTP" checked={adv.sftp} onChange={() => updateAdv('sftp', !adv.sftp)} />
          <CheckItem label="启用 lrzsz" tooltip="启用后，支持 rz/sz 命令传输文件" checked={adv.lrzsz} onChange={() => updateAdv('lrzsz', !adv.lrzsz)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="启用 trzsz" checked={adv.trzsz} onChange={() => {}} disabled />
          <CheckItem label="SFTP-SUDO" tooltip="启用后，SFTP 将自动使用 root 用户操作文件，请保证该账号具备 sudo 权限！" checked={adv.sftpSudo} onChange={() => updateAdv('sftpSudo', !adv.sftpSudo)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="启用 X11 转发" tooltip="开启 X11 转发后，需安装并打开 Xming!" checked={adv.x11} onChange={() => updateAdv('x11', !adv.x11)} />
          <CheckItem label="终端增强模式" tooltip="启用后，支持 hex-rz, hex-sz, hex-edit, hex-open 等增强命令" checked={adv.terminalEnhance} onChange={() => updateAdv('terminalEnhance', !adv.terminalEnhance)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="纯终端模式" tooltip="启用后，提供纯终端视图，在连接堡垒机，交换机，路由器等设备，需要打开此选项" checked={adv.pureTerminal} onChange={() => updateAdv('pureTerminal', !adv.pureTerminal)} />
          <CheckItem label="录制日志" tooltip="启用后，将自动录制终端输出至日志文件，请提前在设置-SSH/SFTP 页面中设置储存路径" checked={adv.recordLog} onChange={() => updateAdv('recordLog', !adv.recordLog)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
        <div>
          <label className={labelClass}>X11 Display</label>
          <input type="text" className={`${inputClass} ${!adv.x11 ? 'bg-bg-hover text-text-disabled select-none' : ''}`} value={adv.x11Display} onChange={(e) => updateAdv('x11Display', e.target.value)} disabled={!adv.x11} />
        </div>
        <div>
          <label className={labelClass}>SFTP 命令</label>
          <input type="text" className={inputClass} value={adv.sftpCommand} onChange={(e) => updateAdv('sftpCommand', e.target.value)} />
        </div>
        <div>
          <HoverTooltip text="值大于 0 则开启，超过时间未输入会自动清空输入+回车">
            <label className={labelClass}>终端心跳时间(秒)</label>
          </HoverTooltip>
          <input type="text" className={inputClass} value={adv.heartbeat} onChange={(e) => updateAdv('heartbeat', e.target.value)} />
          <p className="text-text-3 text-[10px] mt-1 truncate">值大于 0 则开启，超过时间未输入会自动清...</p>
        </div>
        <div>
          <label className={labelClass}>连接超时(秒)</label>
          <input type="text" className={inputClass} value={adv.connectTimeout} onChange={(e) => updateAdv('connectTimeout', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>编码</label>
          <div className="relative">
            <select className={selectClass} value={adv.encoding} onChange={(e) => updateAdv('encoding', e.target.value)}>
              {ENCODINGS.map((enc) => <option key={enc}>{enc}</option>)}
            </select>
            {chevronSvg}
          </div>
        </div>
        <div>
          <label className={labelClass}>终端类型</label>
          <div className="relative">
            <select className={selectClass} value={adv.terminalType} onChange={(e) => updateAdv('terminalType', e.target.value)}>
              {TERM_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            {chevronSvg}
          </div>
        </div>
        <div>
          <label className={labelClass}>SFTP 默认路径</label>
          <input type="text" className={inputClass} value={adv.sftpDefaultPath} onChange={(e) => updateAdv('sftpDefaultPath', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>到期时间</label>
          <input type="date" className={`${inputClass} ${!adv.expireDate ? 'text-text-3' : ''}`} value={adv.expireDate} onChange={(e) => updateAdv('expireDate', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>初始执行命令</label>
          <textarea className={`${inputClass} min-h-[60px] resize-none`} value={adv.initCommand} onChange={(e) => updateAdv('initCommand', e.target.value)} />
        </div>
      </div>
    </div>
  )
})
