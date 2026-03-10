/* ── 文件传输弹出层 ── */

import { AppIcon, icons } from '../../icons/AppIcon'

export default function TransferPopover() {
  return (
    <div className="absolute right-0 top-full mt-[12px] w-[420px] bg-bg-card/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] rounded-xl border border-border z-[250] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
      <div className="flex flex-col border-b border-border bg-bg-card/50">
        <div className="flex items-center px-4 pt-3 pb-2 text-[14px] font-medium text-text-1">文件传输</div>
        <div className="flex gap-6 px-4 text-[13px] text-text-3">
          <span className="pb-2 border-b-[3px] border-primary text-primary cursor-pointer font-medium">进行中</span>
          <span className="pb-2 border-b-[3px] border-transparent hover:text-text-1 cursor-pointer transition-colors">队列中</span>
          <span className="pb-2 border-b-[3px] border-transparent hover:text-text-1 cursor-pointer transition-colors">已暂停</span>
          <span className="pb-2 border-b-[3px] border-transparent hover:text-text-1 cursor-pointer transition-colors">失败</span>
          <span className="pb-2 border-b-[3px] border-transparent hover:text-text-1 cursor-pointer transition-colors">已完成</span>
        </div>
      </div>
      <div className="grid grid-cols-[1.5fr_1fr_1fr] px-4 py-2 bg-bg-subtle border-b border-border text-[12px] text-text-3 font-medium">
        <div>名称</div>
        <div>连接</div>
        <div className="flex justify-between"><span>状态</span><span>信息</span></div>
      </div>
      <div className="h-[280px] flex flex-col items-center justify-center text-text-3 bg-bg-card/50">
        <AppIcon icon={icons.cloudFog} size={48} className="mb-2 opacity-30" />
        <span className="text-[13px]">暂无数据</span>
      </div>
    </div>
  )
}
