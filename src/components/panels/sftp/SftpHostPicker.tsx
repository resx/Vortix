import { useMemo } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'
import { useAssetStore } from '../../../stores/useAssetStore'
import type { AssetRow } from '../../../types'

interface Props {
  title?: string
  connecting: boolean
  onSelectLocal: () => void
  onSelectAsset: (asset: AssetRow) => void
}

export default function SftpHostPicker({ title = '选择主机', connecting, onSelectLocal, onSelectAsset }: Props) {
  const tableData = useAssetStore((s) => s.tableData)

  const sshAssets = useMemo(
    () => tableData.filter((row) => row.type === 'asset' && row.protocol === 'ssh'),
    [tableData],
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="text-[13px] font-semibold text-text-1">{title}</div>
        <div className="mt-1 text-[12px] text-text-3">本地目录或已配置 SSH 资产</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3 custom-scrollbar">
        <button
          type="button"
          onClick={onSelectLocal}
          className="mb-2 flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-text-1">本地目录</div>
            <div className="mt-0.5 truncate text-[12px] text-text-3">切换到本地文件系统浏览</div>
          </div>
          <AppIcon icon={icons.folderOpen} size={14} className="text-text-3" />
        </button>
        {sshAssets.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-[12px] text-text-3">
            暂无可用 SSH 资产
          </div>
        ) : (
          <div className="space-y-2">
            {sshAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                disabled={connecting}
                onClick={() => onSelectAsset(asset)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-text-1">{asset.name}</div>
                  <div className="mt-0.5 truncate text-[12px] text-text-3">{asset.user}@{asset.host}</div>
                </div>
                <AppIcon icon={connecting ? icons.loader : icons.chevronRight} size={14} className={connecting ? 'animate-spin text-text-3' : 'text-text-3'} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
