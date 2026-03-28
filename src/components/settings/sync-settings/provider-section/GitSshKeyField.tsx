import { AppIcon, icons } from '../../../icons/AppIcon'
import { SettingRow } from '../../SettingGroup'
import { smallIslandBtn } from './constants'
import type { ProviderSectionProps } from './types'

export function GitSshKeyField({ state, actions }: ProviderSectionProps) {
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
