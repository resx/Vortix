/* ── 更新检测对话框 ── */

import { useState, useEffect } from 'react'
import { AppIcon, icons } from '../icons/AppIcon'
import { useUIStore } from '../../stores/useUIStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { checkForUpdate } from '../../lib/updater'
import type { UpdateCheckResult } from '../../lib/updater'
import { useT } from '../../i18n'

export default function UpdateDialog() {
  const open = useUIStore((s) => s.updateDialogOpen)
  const toggle = useUIStore((s) => s.toggleUpdateDialog)
  const updateChannel = useSettingsStore((s) => s.updateChannel) as 'stable' | 'experimental'
  const t = useT()

  if (!open) return null

  return <UpdateDialogContent key={updateChannel} updateChannel={updateChannel} toggle={toggle} t={t} />
}

function UpdateDialogContent({
  updateChannel,
  toggle,
  t,
}: {
  updateChannel: 'stable' | 'experimental'
  toggle: ReturnType<typeof useUIStore.getState>['toggleUpdateDialog']
  t: ReturnType<typeof useT>
}) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void checkForUpdate(updateChannel)
      .then((data) => {
        if (!cancelled) setResult(data)
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [updateChannel])

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-[999] flex items-center justify-center" onClick={toggle}>
      <div
        className="bg-bg-base rounded-xl shadow-2xl border border-border/60 w-[400px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <h3 className="text-[14px] font-bold text-text-1">{t('dialog.update.title')}</h3>
          <button onClick={toggle} className="p-1.5 hover:bg-bg-hover rounded-md text-text-3 transition-colors">
            <AppIcon icon={icons.close} size={16} />
          </button>
        </div>

        {/* 内容岛屿 */}
        <div className="mx-4 bg-bg-card rounded-xl border border-border/80 shadow-sm overflow-hidden">
          <div className="px-5 py-5">
            {loading && (
              <div className="flex items-center gap-3 text-text-2">
                <AppIcon icon={icons.loader} size={18} className="animate-spin text-primary" />
                <span className="text-[13px]">{t('dialog.update.checking')}</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 text-status-error">
                <AppIcon icon={icons.alertCircle} size={18} />
                <div>
                  <div className="text-[13px] font-medium">{t('dialog.update.error')}</div>
                  <div className="text-[12px] mt-1 opacity-80">{error}</div>
                </div>
              </div>
            )}

            {result && !result.hasUpdate && (
              <div className="flex items-center gap-3 text-chart-green">
                <AppIcon icon={icons.checkCircle} size={18} />
                <div>
                  <div className="text-[13px] font-medium">{t('dialog.update.latest')}</div>
                  <div className="text-[12px] text-text-3 mt-1">v{result.currentVersion}</div>
                </div>
              </div>
            )}

            {result && result.hasUpdate && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <AppIcon icon={icons.download} size={18} />
                  <span className="text-[13px] font-medium">{t('dialog.update.available')}</span>
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
                  <span className="text-text-3">{t('dialog.update.currentVersion')}</span>
                  <span className="text-text-1 font-mono">v{result.currentVersion}</span>
                  <span className="text-text-3">{t('dialog.update.latestVersion')}</span>
                  <span className="text-primary font-mono font-medium">v{result.latestVersion}</span>
                  <span className="text-text-3">{t('dialog.update.channel')}</span>
                  <span className="text-text-1">
                    {updateChannel === 'stable' ? t('dialog.update.channel.stable') : t('dialog.update.channel.experimental')}
                  </span>
                </div>
                {result.releaseNotes && (
                  <div className="mt-1 p-2.5 bg-bg-base rounded-lg text-[12px] text-text-2 max-h-[120px] overflow-y-auto custom-scrollbar whitespace-pre-wrap leading-relaxed">
                    {result.releaseNotes}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-5 py-3.5 flex justify-end gap-3">
          <button className="text-xs text-orange-500 hover:text-orange-600 transition-colors" onClick={toggle}>
            {t('common.close')}
          </button>
          {result?.hasUpdate && (
            <button
              className="text-xs font-medium text-primary hover:opacity-80 transition-colors"
              onClick={() => window.open(result.releaseUrl, '_blank')}
            >
              {t('dialog.update.download')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
