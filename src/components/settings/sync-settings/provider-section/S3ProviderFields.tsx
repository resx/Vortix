import { SettingsDropdown } from '../../../ui/select'
import { SettingRow } from '../../SettingGroup'
import { EncryptionKeyRow, TlsToggleRow } from '../SyncSettingsFields'
import { inputCls } from './constants'
import type { ProviderSectionProps } from './types'

export function S3ProviderFields({ state }: ProviderSectionProps) {
  return (
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
  )
}
