import { useState, useEffect, useRef } from 'react'
import {
  Sun, Moon, Monitor, User, Crown, MoreVertical,
  Pin, Minus, Square, X, ChevronRight,
  History, Languages, CircleHelp, Settings,
  RotateCw, LogOut, ExternalLink, Copy, Search,
  CloudFog, Check, FileUp, FolderArchive,
} from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '../ui/dropdown-menu'
import { RECENT_PROJECTS, MOCK_HISTORY_CMDS } from '../../data/mock'

/* ── 自定义 SVG 图标 ── */

function TransferIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 0 0 20" strokeDasharray="4 4" />
      <path d="M12 2a10 10 0 0 1 0 20" />
      <path d="M12 8v8M8 12l4 4 4-4" />
    </svg>
  )
}

function BroadcastIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M8 8a6 6 0 0 1 8 0" />
      <path d="M8 16a6 6 0 0 0 8 0" />
      <path d="M5 5a10 10 0 0 1 14 0" />
      <path d="M5 19a10 10 0 0 0 14 0" />
    </svg>
  )
}

function CloudClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      <circle cx="15" cy="14" r="3" fill="var(--bg-card, #fff)" stroke="currentColor" />
      <path d="M15 12.5v1.5l1 1" stroke="currentColor" />
    </svg>
  )
}

/* ── HeaderTopButton ── */

function HeaderTopButton({ icon: Icon, onClick, tooltip, isActive = false }: {
  icon: React.ComponentType<{ className?: string }>
  onClick?: (e: React.MouseEvent) => void
  tooltip?: string
  isActive?: boolean
}) {
  return (
    <div className="group/topbtn relative flex items-center justify-center">
      <button
        onClick={(e) => { e.stopPropagation(); onClick?.(e) }}
        className={`transition-colors p-1 rounded ${isActive ? 'text-primary bg-primary-bg' : 'text-text-2 hover:text-text-1 hover:bg-border/50'}`}
      >
        <Icon className="w-[15px] h-[15px]" />
      </button>
      {tooltip && (
        <div className="absolute top-full mt-[8px] hidden group-hover/topbtn:flex items-center flex-col z-[200]">
          <div className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-tooltip-bg" />
          <div className="bg-tooltip-bg text-tooltip-text text-[12px] px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-xl font-medium tracking-wide leading-none">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 全息指令盒 Logo ── */

function GlitchBox({ size = 22 }: { size?: number }) {
  const fontSize = Math.round(size * 0.55)
  const scanLineSize = size <= 24 ? 2 : 4
  const isDark = document.documentElement.classList.contains('dark')
  return (
    <div
      className={`relative rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 ${
        isDark
          ? 'bg-[#000] border border-gray-700 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
          : 'bg-[#111] border border-gray-800 shadow-sm'
      }`}
      style={{ width: size, height: size }}
    >
      {/* CRT 扫描线 */}
      <div
        className="absolute inset-0 z-20 pointer-events-none opacity-40"
        style={{ background: `linear-gradient(transparent 50%, rgba(0,0,0,0.5) 50%)`, backgroundSize: `100% ${scanLineSize}px` }}
      />
      <div className="relative flex font-mono font-black tracking-tighter" style={{ fontSize: `${fontSize}px` }}>
        <span className="absolute text-cyan-400 -left-[1px] top-[1px] mix-blend-screen blur-[0.3px]" style={{ animation: 'holoFlicker 5s infinite' }}>
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite' }}>_</span>
        </span>
        <span className="absolute text-rose-500 left-[1px] -top-[1px] mix-blend-screen blur-[0.3px]" style={{ animation: 'holoFlicker 5s infinite 150ms' }}>
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite' }}>_</span>
        </span>
        <span className="relative z-10 text-white">
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite', filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }}>_</span>
        </span>
      </div>
    </div>
  )
}

/* ── Kinetic Pulse Logo 组合 ── */

function VortixLogoGroup({ iconSize = 22, fontSize = '15px' }: { iconSize?: number; fontSize?: string }) {
  return (
    <div className="flex items-center">
      <GlitchBox size={iconSize} />
      <div className="flex flex-col ml-2 mt-0.5">
        <span
          className="text-text-1"
          style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          Vortix
        </span>
        <div className="h-[2px] w-full mt-1 relative overflow-hidden rounded-full bg-border/60">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-400/40 to-transparent" />
          <div className="absolute h-full w-8 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" style={{ animation: 'trackPulse 2.5s cubic-bezier(0.4,0,0.2,1) infinite' }} />
        </div>
      </div>
    </div>
  )
}

/* ── 弹出层组件 ── */

function TransferPopover() {
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
        <CloudFog size={48} className="mb-2 opacity-30" strokeWidth={1} />
        <span className="text-[13px]">暂无数据</span>
      </div>
    </div>
  )
}

function BroadcastPopover({ assetName }: { assetName: string }) {
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
            <Check size={10} className="text-white" strokeWidth={3} />
          </div>
          <span className="text-[13px] text-text-1 font-mono">{assetName}</span>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-border bg-bg-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative group/action">
            <button className="p-1.5 text-icon-action hover:bg-border rounded transition-colors"><FileUp size={16} /></button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/action:block bg-tooltip-bg text-tooltip-text text-[11px] px-2 py-1 rounded shadow-md whitespace-nowrap">批量上传文件</div>
          </div>
          <div className="relative group/action">
            <button className="p-1.5 text-chart-green hover:bg-border rounded transition-colors"><FolderArchive size={16} /></button>
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

function HistoryPopover() {
  return (
    <div className="absolute right-0 top-full mt-[12px] w-[340px] bg-bg-card/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] rounded-xl border border-border z-[250] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border bg-bg-card/50">
        <div className="text-[14px] font-medium text-text-1 flex items-center gap-3">
          历史命令
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3" />
            <input type="text" placeholder="历史命令过滤" className="w-[160px] h-[26px] pl-7 pr-2 bg-bg-subtle border border-border rounded text-[12px] text-text-1 outline-none focus:border-primary transition-colors" />
          </div>
        </div>
        <button className="text-[#F53F3F] hover:bg-[#FDECE8] dark:hover:bg-[#3D2020] px-2 py-1.5 rounded text-[12px] flex items-center gap-1 transition-colors">
          <X size={14} />清除
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto p-1 custom-scrollbar bg-bg-card/50">
        {MOCK_HISTORY_CMDS.map((cmd, i) => (
          <div key={i} className="flex flex-col group hover:bg-bg-subtle rounded-lg p-2.5 transition-colors cursor-pointer border border-transparent hover:border-border/50 mx-1 my-0.5">
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-[13px] text-text-1 break-all leading-snug">{cmd.cmd}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button className="p-1 text-text-3 hover:text-primary hover:bg-primary-bg rounded"><Copy size={14} /></button>
                <button className="p-1 text-text-3 hover:text-[#F53F3F] hover:bg-[#FDECE8] dark:hover:bg-[#3D2020] rounded"><X size={14} /></button>
              </div>
            </div>
            <span className="text-[11px] text-text-3 mt-1.5 font-mono">{cmd.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Header 主组件 ── */

export default function Header() {
  const activeTabId = useAppStore((s) => s.activeTabId)
  const tabs = useAppStore((s) => s.tabs)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const menuVariant = useAppStore((s) => s.menuVariant)
  const toggleSettings = useAppStore((s) => s.toggleSettings)

  // 主题切换
  const themeMode = useSettingsStore((s) => s.proxyMode)
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const themeIcon = themeMode === 'light' ? Sun : themeMode === 'dark' ? Moon : Monitor
  const themeLabel = themeMode === 'light' ? '亮色模式' : themeMode === 'dark' ? '暗黑模式' : '跟随系统'
  const cycleTheme = () => {
    const next = themeMode === 'light' ? 'dark' : themeMode === 'dark' ? 'auto' : 'light'
    updateSetting('proxyMode', next)
  }

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isAssetTab = activeTab?.type === 'asset'
  const isConnected = activeTab?.status === 'connected'

  // 弹出层状态
  const [activePopover, setActivePopover] = useState<'transfer' | 'broadcast' | 'history' | null>(null)
  const headerToolsRef = useRef<HTMLDivElement>(null)

  // 切换标签页时重置弹出层
  useEffect(() => {
    setActivePopover(null)
  }, [activeTabId])

  // 点击外部关闭弹出层
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headerToolsRef.current && !headerToolsRef.current.contains(e.target as Node)) {
        setActivePopover(null)
      }
    }
    if (activePopover) window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [activePopover])

  const headerIcons = [
    { Icon: User, label: '用户' },
  ]

  const windowIcons = [
    { Icon: Pin, label: '置顶' },
    { Icon: Minus, label: '最小化' },
    { Icon: Square, label: '最大化', small: true },
    { Icon: X, label: '关闭' },
  ]

  return (
    <header id="header" className="h-[48px] bg-bg-base flex items-center justify-between px-3 shrink-0 select-none z-10">
      {/* Logo 区域 */}
      <div id="header-logo" className="w-[330px] flex items-center gap-2 shrink-0">
        <button className="flex items-center" onClick={() => setActiveTab('list')}>
          <VortixLogoGroup />
        </button>

        {isAssetTab && activeTab?.assetRow && (
          <div id="header-breadcrumb" className="flex items-center gap-1 text-[13px] text-text-3 ml-2">
            <ChevronRight className="w-3.5 h-3.5" />
            {activeTab.assetRow.folderName && (
              <>
                <span className="hover:text-text-1 cursor-pointer transition-colors">{activeTab.assetRow.folderName}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
            <span className="text-text-1 font-medium">{activeTab.assetRow.name}</span>
          </div>
        )}
      </div>

      {/* 右侧操作区 */}
      <div id="header-actions" className="flex items-center gap-4">
        {/* Pro 徽章 */}
        <div className="flex items-center gap-1 bg-[#FDF6EC] dark:bg-[#3D3020] text-[#E6A23C] border border-[#F3D19E] dark:border-[#5A4520] px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer hover:bg-[#F5E8C8] dark:hover:bg-[#4A3A20] transition-colors">
          <Crown className="w-3 h-3" />
          Pro
        </div>

        {/* 功能图标 */}
        <div className="flex items-center gap-3 text-text-2">

          {/* 动态连接工具 — 仅在资产已连接时显示 */}
          {isAssetTab && isConnected && (
            <div className="flex items-center gap-3.5 mr-2" ref={headerToolsRef}>
              {/* 文件传输 */}
              <div className="relative">
                <HeaderTopButton
                  icon={TransferIcon}
                  tooltip="文件传输"
                  isActive={activePopover === 'transfer'}
                  onClick={() => setActivePopover(prev => prev === 'transfer' ? null : 'transfer')}
                />
                {activePopover === 'transfer' && <TransferPopover />}
              </div>

              {/* 命令输入广播 */}
              <div className="relative">
                <HeaderTopButton
                  icon={BroadcastIcon}
                  tooltip="命令输入广播"
                  isActive={activePopover === 'broadcast'}
                  onClick={() => setActivePopover(prev => prev === 'broadcast' ? null : 'broadcast')}
                />
                {activePopover === 'broadcast' && <BroadcastPopover assetName={activeTab?.label ?? ''} />}
              </div>

              {/* 历史命令 */}
              <div className="relative">
                <HeaderTopButton
                  icon={CloudClockIcon}
                  tooltip="历史命令"
                  isActive={activePopover === 'history'}
                  onClick={() => setActivePopover(prev => prev === 'history' ? null : 'history')}
                />
                {activePopover === 'history' && <HistoryPopover />}
              </div>
            </div>
          )}

          {/* 主题切换 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={cycleTheme} className="hover:text-text-1 transition-colors">
                {(() => { const Icon = themeIcon; return <Icon className="w-[15px] h-[15px]" /> })()}
              </button>
            </TooltipTrigger>
            <TooltipContent>{themeLabel}</TooltipContent>
          </Tooltip>

          {headerIcons.map(({ Icon, label }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <button className="hover:text-text-1 transition-colors">
                  <Icon className="w-[15px] h-[15px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}

          {/* 主菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="hover:text-text-1 transition-colors">
                <MoreVertical className="w-[15px] h-[15px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent variant={menuVariant} align="end" sideOffset={12}>
              <DropdownMenuItem>
                <div className="flex items-center gap-2.5">
                  <ExternalLink className="w-[14px] h-[14px] text-text-2" />
                  新窗口
                </div>
                <DropdownMenuShortcut>Ctrl+Shift+H</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex items-center gap-2.5">
                  <Copy className="w-[14px] h-[14px] text-text-2" />
                  复制窗口
                </div>
                <DropdownMenuShortcut>Ctrl+Shift+N</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <History className="w-[14px] h-[14px] text-text-2" />
                  最近项目
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent sideOffset={4} side="left">
                    {RECENT_PROJECTS.map((proj, i) => (
                      <DropdownMenuItem key={i}>
                        <div className="flex items-center gap-2.5">
                          <proj.icon className="w-[14px] h-[14px] text-text-2" />
                          {proj.name}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Languages className="w-[14px] h-[14px] text-text-2" />
                  语言
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent sideOffset={4} side="left">
                    <DropdownMenuItem className="bg-primary-bg text-primary">
                      中文(当前)
                    </DropdownMenuItem>
                    <DropdownMenuItem>English</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <CircleHelp className="w-[14px] h-[14px] text-text-2" />
                  帮助
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent sideOffset={4} side="left">
                    <DropdownMenuItem>提交问题</DropdownMenuItem>
                    <DropdownMenuItem>常见问题</DropdownMenuItem>
                    <DropdownMenuItem>更新日志</DropdownMenuItem>
                    <DropdownMenuItem>检测更新</DropdownMenuItem>
                    <DropdownMenuItem>清除无效数据</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>关于</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={toggleSettings}>
                <div className="flex items-center gap-2.5">
                  <Settings className="w-[14px] h-[14px] text-text-2" />
                  设置
                </div>
                <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex items-center gap-2.5">
                  <Search className="w-[14px] h-[14px] text-text-2" />
                  快速搜索
                </div>
                <DropdownMenuShortcut>Ctrl+Shift+F</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex items-center gap-2.5">
                  <RotateCw className="w-[14px] h-[14px] text-text-2" />
                  重载页面
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div className="flex items-center gap-2.5">
                  <LogOut className="w-[14px] h-[14px] text-text-2" />
                  退出
                </div>
                <DropdownMenuShortcut>Alt+F4</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 窗口控制 */}
        <div className="flex items-center gap-4 text-text-2 ml-2 border-l border-border pl-4">
          {windowIcons.map(({ Icon, label, small }) => (
            <Tooltip key={label}>
              <TooltipTrigger asChild>
                <button className="hover:text-text-1 transition-colors">
                  <Icon className={small ? 'w-3 h-3' : 'w-[15px] h-[15px]'} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </header>
  )
}
