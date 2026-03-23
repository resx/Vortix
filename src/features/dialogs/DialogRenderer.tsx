import { useState } from 'react'
import IslandModal from '../../components/ui/island-modal'
import { useUIStore } from '../../stores/useUIStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { getDialogs } from '../../registries/dialog.registry'
import { useT } from '../../i18n'

export default function DialogRenderer() {
  // Subscribe dialog open flags to trigger re-render.
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const sshConfigOpen = useUIStore((s) => s.sshConfigOpen)
  const localTermConfigOpen = useUIStore((s) => s.localTermConfigOpen)
  const quickSearchOpen = useUIStore((s) => s.quickSearchOpen)
  const updateDialogOpen = useUIStore((s) => s.updateDialogOpen)
  const clearDataDialogOpen = useUIStore((s) => s.clearDataDialogOpen)
  const reloadDialogOpen = useUIStore((s) => s.reloadDialogOpen)
  const batchEditOpen = useUIStore((s) => s.batchEditOpen)
  const syncConflictOpen = useUIStore((s) => s.syncConflictOpen)
  const hostKeyDialogOpen = useUIStore((s) => s.hostKeyDialogOpen)
  const confirmDialogOpen = useUIStore((s) => s.confirmDialogOpen)
  const shortcutDialogOpen = useShortcutStore((s) => s.shortcutDialogOpen)
  const shortcutGroupDialogOpen = useShortcutStore((s) => s.shortcutGroupDialogOpen)

  void settingsOpen; void sshConfigOpen; void localTermConfigOpen
  void quickSearchOpen; void updateDialogOpen; void clearDataDialogOpen
  void reloadDialogOpen; void batchEditOpen; void syncConflictOpen
  void hostKeyDialogOpen; void confirmDialogOpen; void shortcutDialogOpen; void shortcutGroupDialogOpen

  return (
    <>
      {getDialogs().map(({ id, component: Comp, isOpen }) =>
        isOpen() ? <Comp key={id} /> : null
      )}
      <GlobalConfirmDialog />
    </>
  )
}

function GlobalConfirmDialog() {
  const t = useT()
  const open = useUIStore((s) => s.confirmDialogOpen)
  const payload = useUIStore((s) => s.confirmDialog)
  const close = useUIStore((s) => s.closeConfirmDialog)
  const resolve = useUIStore((s) => s.resolveConfirmDialog)
  const [submitting, setSubmitting] = useState(false)

  if (!open || !payload) return null

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      await resolve(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <IslandModal
      title={payload.title ?? t('common.confirm')}
      isOpen={open}
      onClose={submitting ? () => {} : close}
      width="max-w-[420px]"
      padding="px-5 py-4"
      footer={(
        <div className="w-full flex justify-end gap-3">
          <button
            onClick={close}
            disabled={submitting}
            className="island-btn px-3.5 py-1.5 text-text-2 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-60"
          >
            {payload.cancelText ?? t('common.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white transition-opacity disabled:opacity-60 ${payload.danger ? 'bg-red-500 hover:opacity-90' : 'bg-primary hover:opacity-90'}`}
          >
            {submitting ? t('common.loading') : (payload.confirmText ?? t('common.confirm'))}
          </button>
        </div>
      )}
    >
      <p className="text-[13px] text-text-2 leading-relaxed">{payload.description}</p>
    </IslandModal>
  )
}
