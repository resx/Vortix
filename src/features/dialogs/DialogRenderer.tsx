/* ── 对话框渲染器 ── */
/* 订阅 UI store 变化，根据注册表渲染打开的对话框 */

import { useUIStore } from '../../stores/useUIStore'
import { useShortcutStore } from '../../stores/useShortcutStore'
import { getDialogs } from '../../registries/dialog.registry'

export default function DialogRenderer() {
  // 订阅所有对话框相关的 boolean，触发 re-render
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const sshConfigOpen = useUIStore((s) => s.sshConfigOpen)
  const localTermConfigOpen = useUIStore((s) => s.localTermConfigOpen)
  const quickSearchOpen = useUIStore((s) => s.quickSearchOpen)
  const updateDialogOpen = useUIStore((s) => s.updateDialogOpen)
  const clearDataDialogOpen = useUIStore((s) => s.clearDataDialogOpen)
  const reloadDialogOpen = useUIStore((s) => s.reloadDialogOpen)
  const batchEditOpen = useUIStore((s) => s.batchEditOpen)
  const syncConflictOpen = useUIStore((s) => s.syncConflictOpen)
  const shortcutDialogOpen = useShortcutStore((s) => s.shortcutDialogOpen)

  // 触发依赖收集（上面的 selectors 确保 re-render）
  void settingsOpen; void sshConfigOpen; void localTermConfigOpen
  void quickSearchOpen; void updateDialogOpen; void clearDataDialogOpen
  void reloadDialogOpen; void batchEditOpen; void syncConflictOpen; void shortcutDialogOpen

  return (
    <>
      {getDialogs().map(({ id, component: Comp, isOpen }) =>
        isOpen() ? <Comp key={id} /> : null
      )}
    </>
  )
}
