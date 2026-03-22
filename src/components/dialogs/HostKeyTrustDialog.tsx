import IslandModal from '../ui/island-modal'
import { AppIcon, icons } from '../icons/AppIcon'
import { useUIStore } from '../../stores/useUIStore'
import { useT } from '../../i18n'

export default function HostKeyTrustDialog() {
  const t = useT()
  const open = useUIStore((s) => s.hostKeyDialogOpen)
  const payload = useUIStore((s) => s.hostKeyDialog)
  const resolve = useUIStore((s) => s.resolveHostKeyDialog)

  if (!open || !payload) return null

  const isMismatch = payload.reason === 'mismatch'
  const connectionLabel = payload.connectionName?.trim() || `${payload.username}@${payload.host}`
  const roleLabel = payload.hostRole ? t(`hostkey.dialog.role.${payload.hostRole}`) : null
  const hopLabel =
    payload.hopCount && payload.hopCount > 1 && payload.hopIndex
      ? `${payload.hopIndex}/${payload.hopCount}`
      : null

  return (
    <IslandModal
      title={t(isMismatch ? 'hostkey.dialog.title.mismatch' : 'hostkey.dialog.title.unknown')}
      isOpen={open}
      onClose={() => resolve('reject')}
      width="max-w-lg"
      padding="px-5 py-4"
      footer={(
        <div className="w-full flex items-center justify-end gap-2">
          <button
            onClick={() => resolve('reject')}
            className="px-3.5 py-1.5 rounded-lg bg-bg-subtle text-text-2 text-[12px] font-medium hover:bg-bg-hover transition-colors"
          >
            {t('hostkey.dialog.cancel')}
          </button>
          <button
            onClick={() => resolve(isMismatch ? 'replace' : 'trust')}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
              isMismatch
                ? 'bg-status-error/10 text-status-error hover:bg-status-error/20'
                : 'bg-primary text-white hover:opacity-90'
            }`}
          >
            {t(isMismatch ? 'hostkey.dialog.replace' : 'hostkey.dialog.trust')}
          </button>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
          isMismatch ? 'border-status-error/20 bg-status-error/5' : 'border-primary/15 bg-primary/5'
        }`}>
          <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${
            isMismatch ? 'bg-status-error/10 text-status-error' : 'bg-primary/10 text-primary'
          }`}>
            <AppIcon icon={isMismatch ? icons.alertTriangle : icons.lock} size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="text-[13px] font-medium text-text-1">{connectionLabel}</div>
              {roleLabel && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isMismatch ? 'bg-status-error/10 text-status-error' : 'bg-primary/10 text-primary'
                }`}>
                  {roleLabel}
                </span>
              )}
              {hopLabel && (
                <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[10px] font-medium text-text-2">
                  {hopLabel}
                </span>
              )}
            </div>
            <div className="mt-1 text-[12px] leading-relaxed text-text-2">
              {isMismatch
                ? t('hostkey.dialog.description.mismatch')
                : t('hostkey.dialog.description.unknown')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[112px_1fr] gap-x-3 gap-y-2 text-[12px]">
          <div className="text-text-3">{t('hostkey.dialog.field.connection')}</div>
          <div className="break-all text-text-1">{connectionLabel}</div>
          {roleLabel && (
            <>
              <div className="text-text-3">{t('hostkey.dialog.field.role')}</div>
              <div className="text-text-1">{roleLabel}</div>
            </>
          )}
          <div className="text-text-3">{t('hostkey.dialog.field.host')}</div>
          <div className="break-all text-text-1">{payload.host}</div>
          <div className="text-text-3">{t('hostkey.dialog.field.port')}</div>
          <div className="text-text-1">{payload.port}</div>
          <div className="text-text-3">{t('hostkey.dialog.field.username')}</div>
          <div className="break-all text-text-1">{payload.username}</div>
          <div className="text-text-3">{t('hostkey.dialog.field.algorithm')}</div>
          <div className="break-all font-mono text-text-1">{payload.keyType}</div>
          <div className="text-text-3">{t('hostkey.dialog.field.sha256')}</div>
          <div className="break-all font-mono text-text-1">{payload.fingerprintSha256}</div>
          {isMismatch && payload.knownFingerprintSha256 && (
            <>
              <div className="text-text-3">{t('hostkey.dialog.field.storedSha256')}</div>
              <div className="break-all font-mono text-status-error">{payload.knownFingerprintSha256}</div>
            </>
          )}
        </div>
      </div>
    </IslandModal>
  )
}
