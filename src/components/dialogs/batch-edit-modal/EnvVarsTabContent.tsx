import { memo, useEffect, useState, type MouseEvent } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import type { EnvTabProps } from './types'

export const EnvVarsTabContent = memo(function EnvVarsTabContent({
  envVars,
  setEnvVars,
  selectedIndex,
  setSelectedIndex,
}: EnvTabProps) {
  const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; x: number; y: number; index: number | null }>({
    visible: false,
    x: 0,
    y: 0,
    index: null,
  })

  useEffect(() => {
    const close = () => setCtxMenu((p) => ({ ...p, visible: false }))
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const handleCtx = (e: MouseEvent, index: number | null) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, index })
  }

  const addVar = () => setEnvVars([...envVars, { name: 'NEW_VAR', value: '' }])

  const removeVar = (i: number) => {
    setEnvVars(envVars.filter((_, idx) => idx !== i))
    setSelectedIndex(null)
  }

  const updateVar = (i: number, field: 'name' | 'value', val: string) =>
    setEnvVars(envVars.map((v, idx) => (idx === i ? { ...v, [field]: val } : v)))

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-200 pb-3">
      <div className="border border-border rounded flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-row border-b border-border bg-bg-subtle">
          <div className="w-[200px] min-w-[200px] px-3 py-1.5 text-[11px] text-text-2 font-medium border-r border-border">名称</div>
          <div className="flex-1 px-3 py-1.5 text-[11px] text-text-2 font-medium">值</div>
        </div>

        <div className="flex-1 overflow-y-auto bg-bg-card flex flex-col" onContextMenu={(e) => handleCtx(e, null)}>
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
                  className={`flex flex-row border-b border-border/30 cursor-pointer transition-colors ${selectedIndex === i ? 'bg-primary/5' : 'hover:bg-bg-hover'}`}
                  onClick={() => setSelectedIndex(i)}
                  onContextMenu={(e) => handleCtx(e, i)}
                >
                  <div className="w-[200px] min-w-[200px] border-r border-border/30">
                    <input type="text" className="w-full bg-transparent px-3 py-1.5 text-xs text-text-1 outline-none" value={env.name} onChange={(e) => updateVar(i, 'name', e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <input type="text" className="w-full bg-transparent px-3 py-1.5 text-xs text-text-1 outline-none" value={env.value} onChange={(e) => updateVar(i, 'value', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {ctxMenu.visible && (
        <div className="fixed bg-bg-card shadow-xl rounded border border-border py-1 w-28 z-50 animate-in fade-in zoom-in-95 duration-100" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          <div className="text-[10px] text-text-3 px-3 py-1 mb-1 border-b border-border/50">操作</div>
          <button className="w-full text-left px-3 py-1.5 text-xs text-text-1 hover:bg-bg-hover flex items-center" onClick={() => { addVar(); setCtxMenu((p) => ({ ...p, visible: false })) }}>
            <AppIcon icon={icons.link} size={12} className="mr-2 text-text-3" /> 新建
          </button>
          <button className="w-full text-left px-3 py-1.5 text-xs text-text-1 hover:bg-bg-hover flex items-center" onClick={() => { if (ctxMenu.index !== null) removeVar(ctxMenu.index); setCtxMenu((p) => ({ ...p, visible: false })) }}>
            <AppIcon icon={icons.close} size={12} className="mr-2 text-text-3" /> 删除
          </button>
        </div>
      )}
    </div>
  )
})
