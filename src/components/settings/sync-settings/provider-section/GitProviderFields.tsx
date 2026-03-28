import { SettingRow } from '../../SettingGroup'
import { EncryptionKeyRow, TlsToggleRow } from '../SyncSettingsFields'
import { inputCls } from './constants'
import { GitSshKeyField } from './GitSshKeyField'
import type { ProviderSectionProps } from './types'

export function GitProviderFields({ state, actions }: ProviderSectionProps) {
  return (
    <div className="sync-provider-grid">
      <SettingRow label="仓库地址">
        <input
          type="text"
          value={state.gitUrl}
          onChange={(event) => state.update('syncGitUrl', event.target.value)}
          placeholder="https:// 或 git@"
          className={`${inputCls} w-full max-w-[360px]`}
        />
      </SettingRow>
      <SettingRow label="分支">
        <input
          type="text"
          value={state.gitBranch}
          onChange={(event) => state.update('syncGitBranch', event.target.value)}
          className={`${inputCls} w-full max-w-[360px]`}
        />
      </SettingRow>
      <SettingRow label="子路径" desc="留空则写入仓库根目录；例如 backup/vortix。">
        <input
          type="text"
          value={state.gitPath}
          onChange={(event) => state.update('syncGitPath', event.target.value)}
          placeholder="相对仓库根目录，可为空"
          className={`${inputCls} w-full max-w-[360px] font-mono`}
        />
      </SettingRow>

      {state.gitAuthType === 'https' ? (
        <>
          <SettingRow label="用户名">
            <input
              type="text"
              value={state.gitUsername}
              onChange={(event) => state.update('syncGitUsername', event.target.value)}
              className={`${inputCls} w-full max-w-[360px]`}
            />
          </SettingRow>
          <SettingRow label="密码 / Token" desc="推荐使用 Personal Access Token。">
            <input
              type="password"
              value={state.gitPassword}
              onChange={(event) => state.update('syncGitPassword', event.target.value)}
              className={`${inputCls} w-full max-w-[360px]`}
            />
          </SettingRow>
          <TlsToggleRow />
        </>
      ) : (
        <GitSshKeyField state={state} actions={actions} />
      )}

      <EncryptionKeyRow />
    </div>
  )
}
