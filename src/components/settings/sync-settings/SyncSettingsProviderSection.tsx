import { AppIcon, icons } from '../../icons/AppIcon'
import { SettingsDropdown } from '../../ui/select'
import { SettingGroup, SettingRow } from '../SettingGroup'
import { EncryptionKeyRow, TlsToggleRow } from './SyncSettingsFields'
import type { SyncSettingsActions, SyncSettingsState } from './sync-settings-types'

const inputCls = 'island-control min-w-0 shrink px-2 text-[11px] placeholder-text-disabled'
const smallIslandBtn = 'island-btn inline-flex h-[26px] items-center justify-center px-2.5 text-[11px] text-text-2 transition-colors'

function GitSshKeyField({
  state,
  actions,
}: {
  state: SyncSettingsState
  actions: SyncSettingsActions
}) {
  return (
    <SettingRow label="SSH 密钥">
      <div className="island-surface w-full max-w-[460px] rounded-2xl p-2">
        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-bg-base/70 px-2 py-0.5 text-[10px] font-medium tracking-[0.02em] text-text-2">
            <AppIcon icon={icons.shield} size={11} className="text-primary" />
            <span>SSH 凭据</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="从本地文件导入私钥"
              onClick={() => void actions.handlePickGitSshKeyFile()}
              className="island-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl transition-colors"
            >
              <AppIcon icon={icons.fileText} size={13} className="text-text-2" />
            </button>
            <button
              type="button"
              title="从密钥管理器中选择"
              onClick={() => state.setShowKeyPicker(true)}
              className="island-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl transition-colors"
            >
              <AppIcon icon={icons.key} size={13} className="text-text-2" />
            </button>
            {state.syncGitSshKeyMode === 'manual' && (
              <button
                type="button"
                title={state.manualKeyVisible ? '隐藏内容' : '显示内容'}
                onClick={() => state.setManualKeyVisible((current) => !current)}
                className="island-btn flex h-7 w-7 cursor-pointer items-center justify-center rounded-xl transition-colors"
              >
                <AppIcon icon={state.manualKeyVisible ? icons.eyeOff : icons.eye} size={13} className="text-text-2" />
              </button>
            )}
          </div>
        </div>

        {state.syncGitSshKeyMode === 'manager' ? (
          state.hasManagerBinding ? (
            <div className="island-surface rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-text-3">当前已绑定</div>
                  <div className="truncate text-[12px] font-medium text-text-1">{state.syncGitSshKeyLabel}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => state.setShowKeyPicker(true)}
                    className={smallIslandBtn}
                  >
                    更换
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      state.update('syncGitSshKey', '')
                      state.update('syncGitSshKeyLabel', '')
                      state.update('syncGitSshKeyMode', 'manager')
                    }}
                    className={smallIslandBtn}
                  >
                    清空
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      state.update('syncGitSshKey', '')
                      state.update('syncGitSshKeyLabel', '')
                      state.update('syncGitSshKeyMode', 'manual')
                    }}
                    className={smallIslandBtn}
                  >
                    手动输入
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 bg-bg-card/70 px-3 py-3">
              <div className="mb-2 text-[12px] text-text-2">尚未选择密钥</div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => state.setShowKeyPicker(true)}
                  className={smallIslandBtn}
                >
                  选择已有密钥
                </button>
                <button
                  type="button"
                  onClick={() => {
                    state.update('syncGitSshKey', '')
                    state.update('syncGitSshKeyLabel', '')
                    state.update('syncGitSshKeyMode', 'manual')
                  }}
                  className={smallIslandBtn}
                >
                  手动输入
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-2">
            <textarea
              value={state.manualKeyVisible ? state.gitSshKey : state.maskedGitSshKey}
              onChange={(event) => {
                if (!state.manualKeyVisible) return
                state.update('syncGitSshKey', event.target.value)
                state.update('syncGitSshKeyLabel', '')
                state.update('syncGitSshKeyMode', 'manual')
              }}
              readOnly={!state.manualKeyVisible}
              placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----'}
              spellCheck={false}
              rows={6}
              className={`sync-key-scrollbar min-h-[118px] w-full max-h-[280px] resize-y overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all rounded-xl border border-border/70 bg-bg-card/90 px-3 py-2 font-mono text-[11px] leading-[1.5] outline-none transition-[border-color,box-shadow] ${
                state.manualKeyVisible
                  ? 'text-text-1 focus:border-primary/60 focus:shadow-[0_0_0_3px_rgba(64,128,255,0.14)]'
                  : 'cursor-default select-none text-text-3'
              }`}
            />
          </div>
        )}

        <div className="px-1 pt-1.5 text-[10px] text-text-3">
          支持 OpenSSH / PEM 格式，推荐优先使用密钥管理器统一维护。
        </div>
      </div>
    </SettingRow>
  )
}

export function SyncSettingsProviderSection({
  state,
  actions,
}: {
  state: SyncSettingsState
  actions: SyncSettingsActions
}) {
  const title = state.repoSource === 'git'
    ? 'Git'
    : state.repoSource === 'webdav'
      ? 'WebDAV'
      : state.repoSource === 's3'
        ? 'S3'
        : '本地目录'

  return (
    <div className="mt-5">
      <div className="mb-3 text-[14px] font-medium text-text-1">{title}</div>
      <SettingGroup>
        {state.repoSource === 'local' && (
          <>
            <SettingRow label="目录">
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={state.pickingDir}
                  onClick={() => void actions.handlePickLocalDir()}
                  className={`island-btn flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-full transition-colors ${state.pickingDir ? 'animate-pulse' : ''}`}
                >
                  <AppIcon icon={icons.folder} size={13} className="text-text-2" />
                </button>
                <input
                  type="text"
                  value={state.syncLocalPath}
                  onChange={(event) => state.update('syncLocalPath', event.target.value)}
                  placeholder="选择或输入同步目录"
                  className={`${inputCls} w-full max-w-[280px]`}
                />
              </div>
            </SettingRow>
            <EncryptionKeyRow />
          </>
        )}

        {state.repoSource === 'git' && (
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
        )}

        {state.repoSource === 'webdav' && (
          <div className="sync-provider-grid">
            <SettingRow label="Endpoint">
              <input
                type="text"
                value={state.webdavEndpoint}
                onChange={(event) => state.update('syncWebdavEndpoint', event.target.value)}
                placeholder="http://webdav.com"
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <SettingRow label="路径">
              <input
                type="text"
                value={state.webdavPath}
                onChange={(event) => state.update('syncWebdavPath', event.target.value)}
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <SettingRow label="用户名">
              <input
                type="text"
                value={state.webdavUsername}
                onChange={(event) => state.update('syncWebdavUsername', event.target.value)}
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <SettingRow label="密码">
              <input
                type="password"
                value={state.webdavPassword}
                onChange={(event) => state.update('syncWebdavPassword', event.target.value)}
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <EncryptionKeyRow />
            <TlsToggleRow />
          </div>
        )}

        {state.repoSource === 's3' && (
          <div className="sync-provider-grid">
            <SettingRow label="Addressing Style">
              <SettingsDropdown
                value={state.s3Style}
                options={[
                  { value: 'virtual-hosted', label: 'Virtual-Hosted Style' },
                  { value: 'path', label: 'Path Style' },
                ]}
                onChange={(value) => state.update('syncS3Style', value)}
                width="w-[220px]"
                triggerWidth="w-[360px] max-w-full"
              />
            </SettingRow>
            <SettingRow label="Endpoint">
              <input
                type="text"
                value={state.s3Endpoint}
                onChange={(event) => state.update('syncS3Endpoint', event.target.value)}
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <SettingRow label="路径">
              <input
                type="text"
                value={state.s3Path}
                onChange={(event) => state.update('syncS3Path', event.target.value)}
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <SettingRow label="Region">
              <input
                type="text"
                value={state.s3Region}
                onChange={(event) => state.update('syncS3Region', event.target.value)}
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <SettingRow label="Bucket">
              <input
                type="text"
                value={state.s3Bucket}
                onChange={(event) => state.update('syncS3Bucket', event.target.value)}
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <SettingRow label="AccessKey">
              <input
                type="text"
                value={state.s3AccessKey}
                onChange={(event) => state.update('syncS3AccessKey', event.target.value)}
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <SettingRow label="SecretAccessKey">
              <input
                type="password"
                value={state.s3SecretKey}
                onChange={(event) => state.update('syncS3SecretKey', event.target.value)}
                className={`${inputCls} w-full max-w-[360px]`}
              />
            </SettingRow>
            <EncryptionKeyRow />
            <TlsToggleRow />
          </div>
        )}
      </SettingGroup>
    </div>
  )
}
