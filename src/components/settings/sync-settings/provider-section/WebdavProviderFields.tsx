import { SettingRow } from '../../SettingGroup'
import { EncryptionKeyRow, TlsToggleRow } from '../SyncSettingsFields'
import { inputCls } from './constants'
import type { ProviderSectionProps } from './types'

export function WebdavProviderFields({ state }: ProviderSectionProps) {
  return (
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
  )
}
