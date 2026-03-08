/* ── 重载确认对话框 ── */

import { X, RotateCw } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useT } from '../../i18n'

export default function ReloadConfirmDialog() {
  const open = useAppStore((s) => s.reloadDialogOpen)
  const toggle = useAppStore((s) => s.toggleReloadDialog)
  const t = useT()

  if (!open) return null

  const handleReload = () => {
    // 预留热更新接口：未来可替换为 HMR 逻辑
    location.reload()
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[999] flex items-center justify-center" onClick={toggle}>
      <div
        className="bg-bg-base rounded-xl shadow-2xl border border-border/60 w-[380px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <h3 className="text-[14px] font-bold text-text-1 flex items-center gap-2">
            <RotateCw size={15} className="text-primary" />
            {t('dialog.reload.title')}
          </h3>
          <button onClick={toggle} className="p-1.5 hover:bg-bg-hover rounded-md text-text-3 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* 内容岛屿 */}
        <div className="mx-4 bg-bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4">
            <p className="text-[13px] text-text-2">{t('dialog.reload.desc')}</p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-3.5 flex justify-end gap-3">
          <button className="text-xs text-orange-500 hover:text-orange-600 transition-colors" onClick={toggle}>
            {t('dialog.reload.cancel')}
          </button>
          <button
            className="text-xs font-medium text-primary hover:opacity-80 transition-colors"
            onClick={handleReload}
          >
            {t('dialog.reload.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
