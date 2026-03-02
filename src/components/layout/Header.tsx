import {
  Moon, User, Crown, MoreVertical,
  Pin, Minus, Square, X, ChevronRight,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'

/* 正八边形 Logo，内嵌 V 字 */
function VortixLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <polygon
        points="9.4,1 22.6,1 31,9.4 31,22.6 22.6,31 9.4,31 1,22.6 1,9.4"
        fill="#1F2329"
      />
      <text
        x="16" y="23"
        textAnchor="middle"
        fill="white"
        fontSize="20"
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
      >V</text>
    </svg>
  )
}

export default function Header() {
  const activeTabId = useAppStore((s) => s.activeTabId)
  const tabs = useAppStore((s) => s.tabs)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isAssetTab = activeTab?.type === 'asset'

  return (
    <header id="header" className="h-[48px] bg-[#F2F3F5] flex items-center justify-between px-3 shrink-0 select-none z-10">
      {/* Logo 区域 - 对齐 ActivityBar + Sidebar */}
      <div id="header-logo" className="w-[330px] flex items-center gap-2 shrink-0">
        <button
          className="flex items-center gap-0"
          onClick={() => setActiveTab('list')}
        >
          <VortixLogo />
          <span className="text-[#1F2329] font-bold text-[15px] tracking-wide ml-[1px]">ortix</span>
        </button>

        {/* 面包屑 */}
        {isAssetTab && activeTab?.assetRow && (
          <div id="header-breadcrumb" className="flex items-center gap-1 text-[13px] text-[#86909C] ml-2">
            <ChevronRight className="w-3.5 h-3.5" />
            {activeTab.assetRow.folderName && (
              <>
                <span>{activeTab.assetRow.folderName}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
            <span className="text-[#1F2329]">{activeTab.assetRow.name}</span>
          </div>
        )}
      </div>

      {/* 右侧操作区 */}
      <div id="header-actions" className="flex items-center gap-4">
        {/* Pro 徽章 */}
        <div className="flex items-center gap-1 bg-[#FDF6EC] text-[#E6A23C] border border-[#F3D19E] px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer hover:bg-[#F5E8C8] transition-colors">
          <Crown className="w-3 h-3" />
          Pro
        </div>

        {/* 功能图标 */}
        <div className="flex items-center gap-3 text-[#4E5969]">
          {[Moon, User, MoreVertical].map((Icon, i) => (
            <div key={i} className="group/hdr relative">
              <button className="hover:text-[#1F2329] transition-colors"><Icon className="w-[15px] h-[15px]" /></button>
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 hidden group-hover/hdr:flex flex-col items-center z-[9999]">
                <div className="w-0 h-0 border-x-[4px] border-x-transparent border-b-[4px] border-b-[#2D2D2D]" />
                <div className="bg-[#2D2D2D] text-white text-[12px] px-2 py-1.5 rounded-md whitespace-nowrap shadow-lg leading-none font-medium">
                  {['深色模式', '用户', '更多'][i]}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 窗口控制 */}
        <div className="flex items-center gap-4 text-[#4E5969] ml-2 border-l border-[#E5E6EB] pl-4">
          {[Pin, Minus, Square, X].map((Icon, i) => (
            <button key={i} className="hover:text-[#1F2329] transition-colors">
              <Icon className={`${i === 2 ? 'w-3 h-3' : 'w-[15px] h-[15px]'}`} />
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
