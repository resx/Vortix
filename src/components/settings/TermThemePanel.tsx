import TermThemeWorkbenchFrame from './theme-workbench/TermThemeWorkbenchFrame'
import TermThemeWorkbenchView from './theme-workbench/TermThemeWorkbenchView'
import { useTermThemeWorkbenchActions } from './theme-workbench/useTermThemeWorkbenchActions'
import { useTermThemeWorkbenchState } from './theme-workbench/useTermThemeWorkbenchState'

interface TermThemePanelProps {
  isOpen: boolean
  onClose: () => void
  windowMode?: boolean
}

export default function TermThemePanel({
  isOpen,
  onClose,
  windowMode = false,
}: TermThemePanelProps) {
  const state = useTermThemeWorkbenchState(isOpen)
  const actions = useTermThemeWorkbenchActions(state)

  if (!isOpen) return null

  return (
    <TermThemeWorkbenchFrame
      title={state.t('themeWorkbench.title')}
      onClose={onClose}
      windowMode={windowMode}
    >
      <TermThemeWorkbenchView state={state} actions={actions} />
    </TermThemeWorkbenchFrame>
  )
}
