/* ── 清除无效数据确认对话框 ── */

import { useState } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { useUIStore } from '../../stores/useUIStore'
import * as api from '../../api/client'
import { useT } from '../../i18n'

export default function ClearDataDialog() {
  const open = useUIStore((s) => s.clearDataDialogOpen)
  const toggle = useUIStore((s) => s.toggleClearDataDialog)
  const t = useT()

  const [cleaning, setCleaning] = useState(false)
  const [result, setResult] = useState<number | null>(null)

  const handleCleanup = async () => {
    if (cleaning) return
    setCleaning(true)
    try {
      const res = await api.cleanupData()
      setResult(res.deleted)
    } catch {
      setResult(0)
    } finally {
      setCleaning(false)
    }
  }

  const handleClose = () => {
    toggle()
    // 关闭后重置状态
    setTimeout(() => setResult(null), 200)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[999] flex items-center justify-center" onClick={handleClose}>
      <div
        className="bg-bg-base rounded-xl shadow-2xl border border-border/60 w-[400px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <h3 className="text-[14px] font-bold text-text-1 flex items-center gap-2">
            <AppIcon icon={icons.trash} size={15} className="text-status-error" />
            {t('dialog.clearData.title')}
          </h3>
          <button onClick={handleClose} className="p-1.5 hover:bg-bg-hover rounded-md text-text-3 transition-colors">
            <AppIcon icon={icons.close} size={16} />
          </button>
        </div>

        {/* 内容岛屿 */}
        <div className="mx-4 bg-bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4">
            {result === null ? (
              <>
                <p className="text-[13px] text-text-2 mb-3">{t('dialog.clearData.desc')}</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2.5 text-[12px] text-text-2">
                    <AppIcon icon={icons.scrollText} size={14} className="text-text-3 shrink-0" />
                    {t('dialog.clearData.orphanHistory')}
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px] text-text-2">
                    <AppIcon icon={icons.fileX} size={14} className="text-text-3 shrink-0" />
                    {t('dialog.clearData.orphanLogs')}
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px] text-text-2">
                    <AppIcon icon={icons.hardDrive} size={14} className="text-text-3 shrink-0" />
                    {t('dialog.clearData.localExpired')}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-[13px] text-chart-green text-center py-2">
                {t('dialog.clearData.success', { count: result })}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-3.5 flex justify-end gap-3">
          <button className="text-xs text-orange-500 hover:text-orange-600 transition-colors" onClick={handleClose}>
            {result !== null ? t('common.close') : t('dialog.clearData.cancel')}
          </button>
          {result === null && (
            <button
              className={`text-xs font-medium transition-colors ${cleaning ? 'text-text-disabled cursor-not-allowed' : 'text-status-error hover:opacity-80'}`}
              onClick={handleCleanup}
              disabled={cleaning}
            >
              {cleaning ? t('dialog.clearData.cleaning') : t('dialog.clearData.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
