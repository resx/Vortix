import { AppIcon, icons } from '../icons/AppIcon'
import { ProtocolIcon } from '../icons/ProtocolIcons'
import { SshConnectDialogForm } from './ssh-connect-dialog/SshConnectDialogForm'
import { useSshConnectDialogState } from './ssh-connect-dialog/useSshConnectDialogState'
import type { SshConnectDialogProps } from './ssh-connect-dialog/types'

export type { DialogMode } from './ssh-connect-dialog/types'

export default function SshConnectDialog({ open, mode, onClose, initialData }: SshConnectDialogProps) {
  const viewModel = useSshConnectDialogState({ open, mode, onClose, initialData })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-bg-card rounded-xl shadow-xl w-[480px] border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-text-1">
            <ProtocolIcon protocol="ssh" size={20} />
            <span className="font-medium text-[15px]">{viewModel.title}</span>
          </div>
          <button onClick={onClose} className="text-text-3 hover:text-text-1 transition-colors">
            <AppIcon icon={icons.close} size={20} />
          </button>
        </div>

        <SshConnectDialogForm viewModel={viewModel} onClose={onClose} />
      </div>
    </div>
  )
}
