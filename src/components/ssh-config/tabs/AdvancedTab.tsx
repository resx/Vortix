import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import HoverTooltip from '../../ui/hover-tooltip'

const inputClass = 'w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1'
const labelClass = 'block text-xs text-text-2 mb-1.5'

const encodings = ['UTF-8', 'GBK', 'GB2312', 'ASCII', 'US-ASCII', 'EUC-JP', 'EUC-KR', 'ISO-2022-JP']
const terminalTypes = ['xterm-256color', 'xterm', 'xterm-16color', 'vt100', 'linux']

interface CheckItemProps {
  label: string
  tooltip?: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
}

function CheckItem({ label, tooltip, checked, onChange, disabled }: CheckItemProps) {
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

  return tooltip ? (
    <HoverTooltip text={tooltip} disabled={disabled && !tooltip}>
      {inner}
    </HoverTooltip>
  ) : inner
}

export default function AdvancedTab() {
  const adv = useSshConfigStore((s) => s.advanced)
  const setAdv = useSshConfigStore((s) => s.setAdvanced)

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-200 pb-6">
      {/* 功能开关 2×4 网格 */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6 px-1">
        {/* 第一行 */}
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="启用 SFTP" checked={adv.sftp} onChange={() => setAdv('sftp', !adv.sftp)} />
          <CheckItem label="启用 lrzsz" tooltip="启用后，支持 rz/sz 命令传输文件" checked={adv.lrzsz} onChange={() => setAdv('lrzsz', !adv.lrzsz)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="启用 trzsz" checked={adv.trzsz} onChange={() => {}} disabled />
          <CheckItem label="SFTP-SUDO" tooltip="启用后，SFTP 将自动使用 root 用户操作文件，请保证该账号具备 sudo 权限！" checked={adv.sftpSudo} onChange={() => setAdv('sftpSudo', !adv.sftpSudo)} />
        </div>

        {/* 第二行 */}
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="启用 X11 转发" tooltip="开启 X11 转发后，需安装并打开 Xming!" checked={adv.x11} onChange={() => setAdv('x11', !adv.x11)} />
          <CheckItem label="终端增强模式" tooltip="启用后，支持 hex-rz, hex-sz, hex-edit, hex-open 等增强命令" checked={adv.terminalEnhance} onChange={() => setAdv('terminalEnhance', !adv.terminalEnhance)} />
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <CheckItem label="纯终端模式" tooltip="启用后，提供纯终端视图，在连接堡垒机，交换机，路由器等设备，需要打开此选项" checked={adv.pureTerminal} onChange={() => setAdv('pureTerminal', !adv.pureTerminal)} />
          <CheckItem label="录制日志" tooltip="启用后，将自动录制终端输出至日志文件，请提前在设置-SSH/SFTP 页面中设置储存路径" checked={adv.recordLog} onChange={() => setAdv('recordLog', !adv.recordLog)} />
        </div>
      </div>

      {/* 表单字段 */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-5">
        {/* X11 Display */}
        <div>
          <label className={labelClass}>X11 Display</label>
          <input
            type="text"
            className={`${inputClass} ${!adv.x11 ? 'bg-bg-hover text-text-disabled select-none' : ''}`}
            value={adv.x11Display}
            onChange={(e) => setAdv('x11Display', e.target.value)}
            disabled={!adv.x11}
          />
        </div>

        {/* SFTP 命令 */}
        <div>
          <label className={labelClass}>SFTP 命令</label>
          <input type="text" className={inputClass} value={adv.sftpCommand} onChange={(e) => setAdv('sftpCommand', e.target.value)} />
        </div>

        {/* 心跳时间 */}
        <div>
          <HoverTooltip text="值大于 0 则开启，超过时间未输入会自动清空输入+回车">
            <label className={labelClass}>终端心跳时间(秒)</label>
          </HoverTooltip>
          <input type="text" className={inputClass} value={adv.heartbeat} onChange={(e) => setAdv('heartbeat', e.target.value)} />
          <p className="text-text-3 text-[10px] mt-1 truncate">值大于 0 则开启，超过时间未输入会自动清...</p>
        </div>

        {/* 连接超时 */}
        <div>
          <label className={labelClass}>连接超时(秒)</label>
          <input type="text" className={inputClass} value={adv.connectTimeout} onChange={(e) => setAdv('connectTimeout', e.target.value)} />
        </div>

        {/* 编码 */}
        <div>
          <label className={labelClass}>编码</label>
          <div className="relative">
            <select
              className={`${inputClass} appearance-none cursor-pointer`}
              value={adv.encoding}
              onChange={(e) => setAdv('encoding', e.target.value)}
            >
              {encodings.map((enc) => <option key={enc}>{enc}</option>)}
            </select>
            <svg className="absolute right-2.5 top-2 text-text-3 pointer-events-none w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>

        {/* 终端类型 */}
        <div>
          <label className={labelClass}>终端类型</label>
          <div className="relative">
            <select
              className={`${inputClass} appearance-none cursor-pointer`}
              value={adv.terminalType}
              onChange={(e) => setAdv('terminalType', e.target.value)}
            >
              {terminalTypes.map((t) => <option key={t}>{t}</option>)}
            </select>
            <svg className="absolute right-2.5 top-2 text-text-3 pointer-events-none w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>

        {/* SFTP 默认路径 */}
        <div>
          <label className={labelClass}>SFTP 默认路径</label>
          <input type="text" className={inputClass} value={adv.sftpDefaultPath} onChange={(e) => setAdv('sftpDefaultPath', e.target.value)} />
        </div>

        {/* 到期时间 */}
        <div>
          <label className={labelClass}>到期时间</label>
          <input
            type="date"
            className={`${inputClass} ${!adv.expireDate ? 'text-text-3' : ''}`}
            value={adv.expireDate}
            onChange={(e) => setAdv('expireDate', e.target.value)}
            placeholder="留空表示永不过期"
          />
        </div>

        {/* 初始执行命令 */}
        <div className="col-span-2">
          <label className={labelClass}>初始执行命令</label>
          <textarea
            className={`${inputClass} min-h-[60px] resize-none`}
            value={adv.initCommand}
            onChange={(e) => setAdv('initCommand', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
