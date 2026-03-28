import { AppIcon, icons } from '../../../icons/AppIcon'
import { SettingRow } from '../../SettingGroup'
import { EncryptionKeyRow } from '../SyncSettingsFields'
import { inputCls } from './constants'
import type { ProviderSectionProps } from './types'

export function LocalProviderFields({ state, actions }: ProviderSectionProps) {
  return (
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
  )
}
