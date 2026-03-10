import { useState, useEffect } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import ResizableHeader from '../shared/ResizableHeader'

export default function EnvVarsTab() {
  const envVars = useSshConfigStore((s) => s.envVars)
  const selectedEnvIndex = useSshConfigStore((s) => s.selectedEnvIndex)
  const setField = useSshConfigStore((s) => s.setField)
  const addEnvVar = useSshConfigStore((s) => s.addEnvVar)
  const removeEnvVar = useSshConfigStore((s) => s.removeEnvVar)

  const [envWidths, setEnvWidths] = useState([200])
  const [showTooltip, setShowTooltip] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; x: number; y: number; index: number | null }>({ visible: false, x: 0, y: 0, index: null })

  useEffect(() => {
    const close = () => setCtxMenu((p) => ({ ...p, visible: false }))
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const handleCtx = (e: React.MouseEvent, index: number | null) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, index })
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-200 pb-3">
      <div className="border border-border rounded flex-1 flex flex-col overflow-hidden">
        {/* 表头 */}
        <div className="flex flex-row border-b border-border bg-bg-subtle">
          <ResizableHeader
            title="名称"
            width={envWidths[0]}
            onResize={(w) => setEnvWidths([w])}
            isLast={false}
            tooltip={
              <div className="relative inline-block ml-1">
                <span
                  className="inline-flex"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  <AppIcon
                    icon={icons.help}
                    size={12}
                    className="text-text-3 cursor-help translate-y-0.5"
                  />
                </span>
                {showTooltip && (
                  <div className="absolute left-1/2 -translate-x-[20%] bottom-full mb-2 w-[400px] bg-tooltip-bg text-tooltip-text text-[11px] rounded shadow-xl p-3 z-50 animate-in fade-in slide-in-from-bottom-1 font-normal whitespace-normal">
                    <ul className="list-disc pl-4 space-y-1.5 leading-relaxed">
                      <li>环境变量设置需要服务器允许，OpenSSH默认不允许修改环境变量，请自行修改sshd配置</li>
                      <li>环境变量支持变量注入，例如要添加PATH环境变量可设置为：<span className="text-white">/xxx/xxx:${'{PATH}'}</span></li>
                    </ul>
                    <div className="absolute top-full left-[20%] -translate-x-1/2 border-[5px] border-transparent border-t-tooltip-bg" />
                  </div>
                )}
              </div>
            }
          />
          <ResizableHeader title="值" isLast flex1 />
        </div>

        {/* 内容区 */}
        <div
          className="flex-1 overflow-y-auto bg-bg-card flex flex-col"
          onContextMenu={(e) => handleCtx(e, null)}
        >
          {envVars.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-3 min-h-[250px]">
              <AppIcon icon={icons.cloudSun} size={56} className="mb-3" />
              <p className="text-xs">鼠标右键添加环境变量</p>
            </div>
          ) : (
            <div className="flex-1">
              {envVars.map((env, i) => (
                <div
                  key={i}
                  className={`flex flex-row border-b border-border/30 cursor-pointer transition-colors ${selectedEnvIndex === i ? 'bg-primary/5' : 'hover:bg-bg-hover'}`}
                  onClick={() => setField('selectedEnvIndex', i)}
                  onContextMenu={(e) => handleCtx(e, i)}
                >
                  <div style={{ width: envWidths[0], minWidth: envWidths[0] }} className="px-3 py-1.5 text-xs text-text-1 border-r border-border/30 truncate">{env.name}</div>
                  <div className="flex-1 px-3 py-1.5 text-xs text-text-1 truncate">{env.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      {ctxMenu.visible && (
        <div
          className="fixed bg-bg-card shadow-xl rounded border border-border py-1 w-28 z-50 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <div className="text-[10px] text-text-3 px-3 py-1 mb-1 border-b border-border/50">操作</div>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-text-1 hover:bg-bg-hover flex items-center"
            onClick={() => { addEnvVar(); setCtxMenu((p) => ({ ...p, visible: false })) }}
          >
            <AppIcon icon={icons.link} size={12} className="mr-2 text-text-3" /> 新建
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-xs text-text-1 hover:bg-bg-hover flex items-center"
            onClick={() => {
              if (ctxMenu.index !== null) removeEnvVar(ctxMenu.index)
              setCtxMenu((p) => ({ ...p, visible: false }))
            }}
          >
            <AppIcon icon={icons.close} size={12} className="mr-2 text-text-3" /> 删除
          </button>
        </div>
      )}
    </div>
  )
}
