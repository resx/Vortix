import { useUIStore, type HostKeyDialogDecision, type HostKeyDialogPayload } from '../stores/useUIStore'

export type HostKeyPromptInput = Omit<HostKeyDialogPayload, 'onDecision'>

export function promptHostKeyTrust(payload: HostKeyPromptInput): Promise<HostKeyDialogDecision> {
  return new Promise((resolve) => {
    useUIStore.getState().openHostKeyDialog({
      ...payload,
      onDecision: resolve,
    })
  })
}

export function closeHostKeyPrompt(requestId?: string | null) {
  const ui = useUIStore.getState()
  if (!requestId) return
  if (ui.hostKeyDialog?.requestId === requestId) {
    ui.closeHostKeyDialog()
  }
}
