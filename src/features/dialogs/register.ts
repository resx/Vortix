/* ── 对话框注册 ── */

import { registerDialog } from '../../registries/dialog.registry'
import { useUIStore } from '../../stores/useUIStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import SettingsPanel from '../../components/settings/SettingsPanel'
import SshConfigDialog from '../../components/ssh-config/SshConfigDialog'
import LocalTerminalConfigDialog from '../../components/local-terminal/LocalTerminalConfigDialog'
import QuickSearchDialog from '../../components/dialogs/QuickSearchDialog'
import UpdateDialog from '../../components/dialogs/UpdateDialog'
import ClearDataDialog from '../../components/dialogs/ClearDataDialog'
import ReloadConfirmDialog from '../../components/dialogs/ReloadConfirmDialog'
import ShortcutDialog from '../../components/dialogs/ShortcutDialog'
import BatchEditModal from '../../components/dialogs/BatchEditModal'
import SyncConflictDialog from '../../components/dialogs/SyncConflictDialog'

export function registerDialogs(): () => void {
  const cleanups = [
    registerDialog({ id: 'settings', component: SettingsPanel, isOpen: () => useUIStore.getState().settingsOpen }),
    registerDialog({ id: 'ssh-config', component: SshConfigDialog, isOpen: () => useUIStore.getState().sshConfigOpen }),
    registerDialog({ id: 'local-term-config', component: LocalTerminalConfigDialog, isOpen: () => useUIStore.getState().localTermConfigOpen }),
    registerDialog({ id: 'quick-search', component: QuickSearchDialog, isOpen: () => useUIStore.getState().quickSearchOpen }),
    registerDialog({ id: 'update', component: UpdateDialog, isOpen: () => useUIStore.getState().updateDialogOpen }),
    registerDialog({ id: 'clear-data', component: ClearDataDialog, isOpen: () => useUIStore.getState().clearDataDialogOpen }),
    registerDialog({ id: 'reload', component: ReloadConfirmDialog, isOpen: () => useUIStore.getState().reloadDialogOpen }),
    registerDialog({ id: 'shortcut', component: ShortcutDialog, isOpen: () => useShortcutStore.getState().shortcutDialogOpen }),
    registerDialog({ id: 'batch-edit', component: BatchEditModal, isOpen: () => useUIStore.getState().batchEditOpen }),
    registerDialog({ id: 'sync-conflict', component: SyncConflictDialog, isOpen: () => useUIStore.getState().syncConflictOpen }),
  ]
  return () => cleanups.forEach(fn => fn())
}
