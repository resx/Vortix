import type { SettingsState } from '../../../stores/useSettingsStore'
import { AppIcon, icons } from '../../icons/AppIcon'
import { SettingsDropdown } from '../../ui/select'
import { Switch } from '../../ui/switch'
import { SettingGroup, SettingRow } from '../SettingGroup'
import { REPO_LABELS, type SyncSettingsActions, type SyncSettingsState } from './sync-settings-types'

const smallIslandBtn = 'island-btn inline-flex h-[26px] items-center justify-center px-2.5 text-[11px] text-text-2 transition-colors'

export function SyncSettingsOverviewSection({
  state,
  actions,
}: {
  state: SyncSettingsState
  actions: SyncSettingsActions
}) {
  return (
    <SettingGroup>
      <SettingRow label="清空本地">
        <div className="flex items-center gap-2">
          <span className="truncate text-[11px] text-text-3">清空当前客户端中的文件夹、连接、快捷键等本地数据</span>
          {state.confirmClear ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => state.setConfirmClear(false)}
                className={`${smallIslandBtn} px-2`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void actions.handlePurgeAllData()}
                className="h-[26px] rounded-lg border border-status-error/30 bg-status-error/10 px-2 text-[11px] font-medium text-status-error transition-colors hover:bg-status-error/20"
              >
                确认清空
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => state.setConfirmClear(true)}
              className={`${smallIslandBtn} shrink-0`}
            >
              清空本地数据
            </button>
          )}
        </div>
      </SettingRow>

      <SettingRow label="同步操作">
        <div className="flex min-w-0 flex-col items-end gap-1.5">
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              disabled={state.syncing || state.testing}
              onClick={() => void actions.handleTest()}
              className={`${smallIslandBtn} gap-1 disabled:opacity-50 ${state.connectionState === 'idle' ? 'border-primary/40 bg-primary/10 text-primary' : ''}`}
            >
              {state.testing
                ? <AppIcon icon={icons.loader} size={11} className="animate-spin" />
                : <AppIcon icon={icons.cloudCog} size={11} />}
              {state.testing ? '测试中...' : (state.repoSource === 'local' ? '测试目录' : '测试连接')}
            </button>
            <button
              type="button"
              disabled={!state.syncActionsEnabled}
              onClick={() => state.setConfirmImport(true)}
              className={`${smallIslandBtn} gap-1 disabled:opacity-50 ${state.preferPull ? 'border-primary/40 bg-primary/10 text-primary' : ''}`}
            >
              {state.syncing
                ? <AppIcon icon={icons.loader} size={11} className="animate-spin" />
                : <AppIcon icon={icons.download} size={11} />}
              导入
            </button>
            <button
              type="button"
              disabled={!state.syncActionsEnabled}
              onClick={() => {
                if (state.fileInfo?.exists) {
                  state.setConfirmExport(true)
                  return
                }
                void actions.handleExport()
              }}
              className={`${smallIslandBtn} gap-1 disabled:opacity-50 ${state.preferPush ? 'border-primary/40 bg-primary/10 text-primary' : ''}`}
            >
              {state.syncing
                ? <AppIcon icon={icons.loader} size={11} className="animate-spin" />
                : <AppIcon icon={icons.upload} size={11} />}
              导出
            </button>
          </div>
          <div className={`max-w-[420px] text-right text-[12px] leading-[1.4] ${state.connectionState === 'error' ? 'text-status-error' : 'text-text-3'}`}>
            {state.syncHintText}
          </div>
          <div className="text-[11px] text-text-3/80">• 同步格式：v5 envelope（兼容读取 v3/v4/legacy）</div>
        </div>
      </SettingRow>

      <SettingRow label={state.repoSource === 'local' ? '清空同步目录' : '删除远端同步包'}>
        {state.confirmDeleteRemote ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => state.setConfirmDeleteRemote(false)}
              className={`${smallIslandBtn} px-2`}
            >
              取消
            </button>
            <button
              type="button"
              disabled={state.syncing}
              onClick={() => void actions.handleDeleteRemote()}
              className="h-[26px] rounded-lg border border-status-error/30 bg-status-error/10 px-2 text-[11px] font-medium text-status-error transition-colors hover:bg-status-error/20 disabled:opacity-50"
            >
              {state.repoSource === 'local' ? '确认清空' : '确认删除'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={state.syncing}
            onClick={() => state.setConfirmDeleteRemote(true)}
            className={`${smallIslandBtn} shrink-0 disabled:opacity-50`}
          >
            {state.repoSource === 'local' ? '清空同步目录' : `删除 ${REPO_LABELS[state.repoSource]} 同步包`}
          </button>
        )}
      </SettingRow>

      {state.repoSource !== 'local' && (
        <SettingRow label="自动同步" desc="在操作完成后自动推送到远端。">
          <Switch checked={state.autoSync} onCheckedChange={() => state.update('syncAutoSync', !state.autoSync)} />
        </SettingRow>
      )}

      <SettingRow label="同步源">
        <div className="flex items-center gap-2">
          {state.repoSource === 'local' && (
            <span className="truncate text-[11px] text-text-3">建议使用云盘目录 / OneDrive 路径实现多设备同步</span>
          )}
          <SettingsDropdown
            value={state.repoSource}
            options={[
              { value: 'local', label: '本地目录' },
              { value: 'git', label: 'Git' },
              { value: 'webdav', label: 'WebDAV' },
              { value: 's3', label: 'S3' },
            ]}
            onChange={(value) => state.update('syncRepoSource', value as SettingsState['syncRepoSource'])}
            width="w-[120px]"
          />
        </div>
      </SettingRow>
    </SettingGroup>
  )
}
