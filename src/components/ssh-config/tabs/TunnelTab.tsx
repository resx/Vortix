import { useState, useEffect } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useSshConfigStore } from '../../../stores/useSshConfigStore'
import ResizableHeader from '../shared/ResizableHeader'
import EditTunnelModal from '../modals/EditTunnelModal'

const tunnelHeaders = ['名称', '类型', '绑定 IP', '绑定端口', '目标 IP', '目标端口', '禁用隧道']

export default function TunnelTab() {
  const tunnels = useSshConfigStore((s) => s.tunnels)
  const removeTunnel = useSshConfigStore((s) => s.removeTunnel)
  const toggleSubModal = useSshConfigStore((s) => s.toggleSubModal)
  const editTunnelOpen = useSshConfigStore((s) => s.subModals.editTunnel)
  const setField = useSshConfigStore((s) => s.setField)

  const [widths, setWidths] = useState([90, 60, 110, 80, 110, 80])
  const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; x: number; y: number; tunnelId?: string }>({ visible: false, x: 0, y: 0 })

  useEffect(() => {
    const close = () => setCtxMenu((p) => ({ ...p, visible: false }))
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const handleContextMenu = (e: React.MouseEvent, tunnelId?: string) => {
    e.preventDefault()
    setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, tunnelId })
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-200 pb-3">
      <div className="border border-border rounded flex-1 flex flex-col overflow-hidden">
        {/* 表头 */}
        <div className="flex flex-row border-b border-border bg-bg-subtle">
          {tunnelHeaders.map((header, idx) => (
            <ResizableHeader
              key={idx}
              title={header}
              width={widths[idx]}
              onResize={(w) => setWidths((prev) => { const next = [...prev]; next[idx] = w; return next })}
              isLast={idx === tunnelHeaders.length - 1}
              flex1={idx === tunnelHeaders.length - 1}
            />
          ))}
        </div>

        {/* 内容区 */}
        <div
          className="flex-1 flex flex-col bg-bg-card overflow-y-auto min-h-[250px]"
          onContextMenu={(e) => handleContextMenu(e)}
        >
          {tunnels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-text-3">
              <AppIcon icon={icons.cloudSun} size={56} className="mb-3" />
              <p className="text-xs">鼠标右键添加隧道</p>
            </div>
          ) : (
            tunnels.map((t) => (
              <div
                key={t.id}
                className="flex flex-row border-b border-border/30 hover:bg-bg-hover cursor-pointer text-xs text-text-1"
                onContextMenu={(e) => handleContextMenu(e, t.id)}
              >
                <div style={{ width: widths[0], minWidth: widths[0] }} className="px-3 py-1.5 border-r border-border/30 truncate">{t.name}</div>
                <div style={{ width: widths[1], minWidth: widths[1] }} className="px-3 py-1.5 border-r border-border/30 truncate">{t.type}</div>
                <div style={{ width: widths[2], minWidth: widths[2] }} className="px-3 py-1.5 border-r border-border/30 truncate">{t.bindIp}</div>
                <div style={{ width: widths[3], minWidth: widths[3] }} className="px-3 py-1.5 border-r border-border/30 truncate">{t.bindPort}</div>
                <div style={{ width: widths[4], minWidth: widths[4] }} className="px-3 py-1.5 border-r border-border/30 truncate">{t.targetIp}</div>
                <div style={{ width: widths[5], minWidth: widths[5] }} className="px-3 py-1.5 border-r border-border/30 truncate">{t.targetPort}</div>
                <div className="flex-1 px-3 py-1.5 truncate">{t.disabled ? '是' : '否'}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      {ctxMenu.visible && (
        <div
          className="fixed bg-bg-card shadow-xl rounded border border-border py-1 w-32 z-50 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <div className="text-[10px] text-text-3 px-3 py-1 mb-1 border-b border-border/50">操作</div>
          <CtxBtn icon={icons.link} label="新建" onClick={() => { setField('editingTunnel', null); toggleSubModal('editTunnel', true) }} />
          {ctxMenu.tunnelId && (
            <>
              <CtxBtn icon={icons.fileEdit} label="编辑" onClick={() => {
                const t = tunnels.find((x) => x.id === ctxMenu.tunnelId)
                if (t) { setField('editingTunnel', t); toggleSubModal('editTunnel', true) }
              }} />
              <CtxBtn icon={icons.pencil} label="重命名" onClick={() => {}} />
              <CtxBtn icon={icons.close} label="删除" onClick={() => { if (ctxMenu.tunnelId) removeTunnel(ctxMenu.tunnelId) }} />
            </>
          )}
        </div>
      )}

      {/* 编辑隧道弹窗 */}
      {editTunnelOpen && <EditTunnelModal />}
    </div>
  )
}

function CtxBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      className="w-full text-left px-3 py-1.5 text-xs text-text-1 hover:bg-bg-hover flex items-center"
      onClick={onClick}
    >
      <AppIcon icon={icon} size={12} className="mr-2 text-text-3" /> {label}
    </button>
  )
}
