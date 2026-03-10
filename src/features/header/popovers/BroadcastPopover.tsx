/* ── 命令输入广播弹出层 ── */

import { AppIcon, icons } from '../../icons/AppIcon'

export default function BroadcastPopover({ assetName }: { assetName: string }) {
  return (
    <div className="absolute right-0 top-full mt-[12px] w-[360px] bg-bg-card/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] rounded-xl border border-border z-[250] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
      <div className="px-4 py-3 border-b border-border bg-bg-card/50">
        <div className="text-[14px] font-medium text-text-1 mb-1">命令输入广播 (专业版)</div>
        <div className="text-[12px] text-text-3">
          可按住 <kbd className="bg-bg-base border border-border px-1 rounded mx-0.5">ALT+</kbd> 鼠标中键点击 进行点选
        </div>
      </div>
      <div className="flex flex-col max-h-[240px] overflow-y-auto custom-scrollbar p-2 bg-bg-card/50">
        <div className="text-[11px] text-text-3 px-2 py-1 font-mono">{assetName}</div>
        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-bg-subtle rounded-md cursor-pointer bg-bg-subtle border border-border/50">
          <div className="w-[14px] h-[14px] bg-primary rounded-[3px] flex items-center justify-center">
            <AppIcon icon={icons.check} size={10} className="text-white" />
          </div>
          <span className="text-[13px] text-text-1 font-mono">{assetName}</span>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-border bg-bg-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative group/action">
            <button className="p-1.5 text-icon-action hover:bg-border rounded transition-colors"><AppIcon icon={icons.fileUp} size={16} /></button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/action:block bg-tooltip-bg text-tooltip-text text-[11px] px-2 py-1 rounded shadow-md whitespace-nowrap">批量上传文件</div>
          </div>
          <div className="relative group/action">
            <button className="p-1.5 text-chart-green hover:bg-border rounded transition-colors"><AppIcon icon={icons.folderArchive} size={16} /></button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/action:block bg-tooltip-bg text-tooltip-text text-[11px] px-2 py-1 rounded shadow-md whitespace-nowrap">批量上传文件夹</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-status-error text-[13px] font-medium hover:opacity-80 transition-opacity">全部关闭</button>
          <button className="text-primary text-[13px] font-medium hover:opacity-80 transition-opacity">全部启用</button>
        </div>
      </div>
    </div>
  )
}
