import type { ReactNode } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import KeyPickerModal from '../KeyPickerModal'
import type { SyncSettingsActions, SyncSettingsState } from './sync-settings-types'
import { formatSyncTime } from './sync-settings-types'

function DialogShell({
  iconClassName,
  iconColorClassName,
  title,
  body,
  children,
}: {
  iconClassName: string
  iconColorClassName: string
  title: string
  body: ReactNode
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
      <div className="island-surface w-full max-w-sm animate-in overflow-hidden rounded-xl fade-in zoom-in duration-200">
        <div className="flex items-start gap-3 px-5 pb-3 pt-5">
          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
            <AppIcon icon={icons.alertTriangle} size={16} className={iconColorClassName} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[14px] font-medium text-text-1">{title}</div>
            <div className="text-[12px] leading-relaxed text-text-2">{body}</div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5">{children}</div>
      </div>
    </div>
  )
}

export function SyncSettingsDialogs({
  state,
  actions,
}: {
  state: SyncSettingsState
  actions: SyncSettingsActions
}) {
  return (
    <>
      {state.confirmImport && (
        <DialogShell
          iconClassName="bg-[#FFD666]/15"
          iconColorClassName="text-[#E6A23C]"
          title="确认导入"
          body="导入会使用远端同步包覆盖本地数据。建议先完成一次导出备份，再执行导入。"
        >
          <button
            type="button"
            onClick={() => state.setConfirmImport(false)}
            className="island-btn rounded-lg px-3.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void actions.handleImport()}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
          >
            确认导入
          </button>
        </DialogShell>
      )}

      {state.confirmExport && (
        <DialogShell
          iconClassName="bg-[#FFD666]/15"
          iconColorClassName="text-[#E6A23C]"
          title="确认导出"
          body="导出会覆盖远端现有同步包，请确认远端内容已经不再需要或已经完成备份。"
        >
          <button
            type="button"
            onClick={() => state.setConfirmExport(false)}
            className="island-btn rounded-lg px-3.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              state.setConfirmExport(false)
              void actions.handleExport()
            }}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
          >
            确认导出
          </button>
        </DialogShell>
      )}

      {state.conflictInfo && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="island-surface w-full max-w-sm animate-in overflow-hidden rounded-xl fade-in zoom-in duration-200">
            <div className="flex items-start gap-3 px-5 pb-3 pt-5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF4D4F]/10">
                <AppIcon icon={icons.alertTriangle} size={16} className="text-status-error" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[14px] font-medium text-text-1">检测到同步冲突</div>
                <div className="mb-1 text-[12px] leading-relaxed text-text-2">
                  {state.conflictInfo.info.reason === 'remote_ahead'
                    ? '远端同步包比本地更新，继续导出会覆盖远端内容。'
                    : '本地数据比远端更新，继续导入会覆盖本地内容。'}
                </div>
                <div className="text-[11px] text-text-3">
                  本地版本: {state.conflictInfo.info.localRevision}
                  {' · '}
                  远端版本: {state.conflictInfo.info.remoteRevision}
                  {state.conflictInfo.info.remoteExportedAt
                    ? ` · 远端时间: ${formatSyncTime(state.conflictInfo.info.remoteExportedAt, true)}`
                    : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5">
              <button
                type="button"
                onClick={() => state.setConflictInfo(null)}
                className="island-btn rounded-lg px-3.5 py-1.5 text-[12px] font-medium text-text-2 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={actions.handleConflictUseRemote}
                className="rounded-lg bg-[#FF4D4F]/10 px-3.5 py-1.5 text-[12px] font-medium text-[#FF4D4F] transition-colors hover:bg-[#FF4D4F]/20"
              >
                使用远端
              </button>
              <button
                type="button"
                onClick={actions.handleConflictUseLocal}
                className="rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
              >
                使用本地
              </button>
            </div>
          </div>
        </div>
      )}

      {state.showKeyPicker && (
        <KeyPickerModal
          onSelect={(key, meta) => {
            state.update('syncGitSshKey', key)
            state.update('syncGitSshKeyLabel', meta?.keyName ?? '')
            state.update('syncGitSshKeyMode', 'manager')
          }}
          onClose={() => state.setShowKeyPicker(false)}
        />
      )}
    </>
  )
}
