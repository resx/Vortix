import { useState } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import IslandModal from '../../ui/island-modal'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import type { TunnelEntry } from '../../../stores/useSshConfigStore'

const inputClass = 'w-full bg-bg-base border border-transparent rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder-text-3 text-text-1'
const labelClass = 'block text-xs text-text-2 mb-1.5'
const errorInputClass = 'w-full bg-bg-base border border-red-300 rounded px-2.5 py-1.5 text-xs h-[30px] outline-none focus:bg-bg-card focus:border-red-400 focus:ring-1 focus:ring-red-300 transition-all placeholder-text-3 text-text-1'

type TunnelMode = '本地' | '远程' | '本地SOCKS5' | '远程SOCKS5'
const modes: TunnelMode[] = ['本地', '远程', '本地SOCKS5', '远程SOCKS5']

export default function EditTunnelModal() {
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const addTunnel = useSshConfigStore((s) => s.addTunnel)
  const editingTunnel = useSshConfigStore((s) => s.editingTunnel)
  const updateTunnel = useSshConfigStore((s) => s.updateTunnel)

  const [mode, setMode] = useState<TunnelMode>(editingTunnel?.type ?? '本地')
  const [name, setName] = useState(editingTunnel?.name ?? '')
  const [bindIp, setBindIp] = useState(editingTunnel?.bindIp ?? '127.0.0.1')
  const [bindPort, setBindPort] = useState(editingTunnel?.bindPort ?? '')
  const [targetIp, setTargetIp] = useState(editingTunnel?.targetIp ?? '127.0.0.1')
  const [targetPort, setTargetPort] = useState(editingTunnel?.targetPort ?? '')
  const [showSocksHelp, setShowSocksHelp] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isSocks = mode.includes('SOCKS5')

  const handleSave = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'name is a required field'
    if (!bindPort.trim()) errs.bindPort = 'bindPort is a required field'
    if (!isSocks && !targetPort.trim()) errs.targetPort = 'srcPort is a required field'
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const entry: TunnelEntry = {
      id: editingTunnel?.id ?? `tunnel-${Date.now()}`,
      name, type: mode, bindIp, bindPort, targetIp, targetPort,
      disabled: editingTunnel?.disabled ?? false,
    }

    if (editingTunnel) updateTunnel(entry.id, entry)
    else addTunnel(entry)
    toggleSubModal('editTunnel', false)
  }

  return (
    <IslandModal
      title="SSH 隧道编辑"
      isOpen
      onClose={() => toggleSubModal('editTunnel', false)}
      width="max-w-[560px]"
      padding="p-4"
      footer={
        <div className="w-full flex justify-end">
          <button onClick={handleSave} className="text-xs text-primary hover:opacity-80 font-medium">保存</button>
        </div>
      }
    >
      {/* 模式 Tab */}
      <div className="flex justify-center mb-5">
        <div className="bg-bg-base/80 p-0.5 rounded-lg inline-flex space-x-0.5">
          {modes.map((tab) => (
            <button
              key={tab}
              onClick={() => setMode(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-all ${mode === tab ? 'bg-bg-card shadow-sm text-text-1 font-medium' : 'text-text-3 hover:text-text-2'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 流程图示 */}
      <div className="relative mb-6 px-2">
        <div className="absolute top-4 left-[16.66%] right-[16.66%] border-t-[1.5px] border-border z-0" />
        <div className="flex justify-between text-center relative z-10">
          <div className="flex-1 flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shadow-sm border-[3px] border-bg-card bg-clip-padding"><AppIcon icon={icons.globe} size={16} /></div>
            <div className="mt-2.5 text-[11px] text-text-2">{isSocks ? '所有 TCP 端口流量' : '单个 TCP 端口流量'}</div>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <div className="w-6 h-6 mt-1 rounded-full bg-orange-400 flex items-center justify-center text-white shadow-sm border-[3px] border-bg-card bg-clip-padding"><AppIcon icon={icons.arrowRight} size={14} /></div>
            <div className="mt-3.5 text-[11px] text-text-2">{mode === '本地' || mode === '本地SOCKS5' ? '本地(绑定)TCP 端口' : '远程(绑定)TCP 端口'}</div>
          </div>
          <div className="flex-1 flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-sm border-[3px] border-bg-card bg-clip-padding"><AppIcon icon={icons.monitor} size={16} /></div>
            <div className="mt-2.5 text-[11px] text-text-2">{mode === '本地' || mode === '本地SOCKS5' ? '远程 TCP 端口' : '本地 TCP 端口'}</div>
          </div>
        </div>
      </div>

      {/* SOCKS5 帮助区 */}
      {isSocks && (
        <div className="mb-5 border-t border-b border-border/50 py-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-text-1 font-medium">SOCKS5-代理使用帮助</span>
            <div className="space-x-3">
              <span className="text-[11px] text-primary cursor-pointer hover:opacity-80">Edge-SOCKS5 插件</span>
              <span className="text-[11px] text-primary cursor-pointer hover:opacity-80">Chrome-SOCKS5 插件</span>
            </div>
          </div>
          <div className="border border-border rounded overflow-hidden">
            <button
              onClick={() => setShowSocksHelp(!showSocksHelp)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-1 bg-bg-subtle hover:bg-bg-hover transition-colors"
            >
              <span>SOCKS5 快捷命令</span>
              {showSocksHelp ? <AppIcon icon={icons.chevronUp} size={14} className="text-text-3" /> : <AppIcon icon={icons.chevronDown} size={14} className="text-text-3" />}
            </button>
            {showSocksHelp && (
              <div className="p-3 bg-bg-card border-t border-border font-mono text-[11px] leading-relaxed text-text-2 space-y-2 whitespace-pre-wrap">
                <div><span className="font-semibold text-text-1">Windows CMD:</span><br />set http_proxy=socks5://localhost:<br />set https_proxy=socks5://localhost:</div>
                <div><span className="font-semibold text-text-1">Mac & Linux Shell:</span><br />export http_proxy="socks5://localhost:"<br />export https_proxy="socks5://localhost:"</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 表单 */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div className="col-span-2">
          <label className={`${labelClass} ${errors.name ? 'text-red-500' : ''}`}>名称</label>
          <input type="text" className={errors.name ? errorInputClass : inputClass} value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = { ...p }; delete n.name; return n }) }} />
          {errors.name && <p className="text-red-500 text-[10px] mt-1 tracking-wide">{errors.name}</p>}
        </div>
        <div>
          <label className={labelClass}>绑定 IP</label>
          <input type="text" className={inputClass} value={bindIp} onChange={(e) => setBindIp(e.target.value)} />
        </div>
        <div>
          <label className={`${labelClass} ${errors.bindPort ? 'text-red-500' : ''}`}>绑定端口</label>
          <input type="text" className={errors.bindPort ? errorInputClass : inputClass} value={bindPort} onChange={(e) => { setBindPort(e.target.value); setErrors((p) => { const n = { ...p }; delete n.bindPort; return n }) }} />
          {errors.bindPort && <p className="text-red-500 text-[10px] mt-1 tracking-wide">{errors.bindPort}</p>}
        </div>
        {!isSocks && (
          <>
            <div>
              <label className={labelClass}>目标 IP</label>
              <input type="text" className={inputClass} value={targetIp} onChange={(e) => setTargetIp(e.target.value)} />
            </div>
            <div>
              <label className={`${labelClass} ${errors.targetPort ? 'text-red-500' : ''}`}>目标端口</label>
              <input type="text" className={errors.targetPort ? errorInputClass : inputClass} value={targetPort} onChange={(e) => { setTargetPort(e.target.value); setErrors((p) => { const n = { ...p }; delete n.targetPort; return n }) }} />
              {errors.targetPort && <p className="text-red-500 text-[10px] mt-1 tracking-wide">{errors.targetPort}</p>}
            </div>
          </>
        )}
      </div>
    </IslandModal>
  )
}
