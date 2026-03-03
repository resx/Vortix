import { useState, useEffect, useRef } from 'react'
import { motion, useDragControls } from 'framer-motion'
import { Pin, PinOff, Minus, Square, X } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { useSettingsStore } from '../../stores/useSettingsStore'
import BasicSettings from './BasicSettings'
import SSHSettings from './SSHSettings'
import DatabaseSettings from './DatabaseSettings'

/* ── 正八边形 Logo（与主 Header 一致） ── */

function VortixLogo({ size = 20 }: { size?: number }) {
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

/* ── 窗口控制按钮 ── */

function WinBtn({ children, onClick, hoverClass = 'hover:bg-[#E5E6EB]' }: {
  children: React.ReactNode
  onClick?: () => void
  hoverClass?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-[28px] h-[28px] flex items-center justify-center rounded-md text-[#86909C] hover:text-[#1F2329] transition-colors ${hoverClass}`}
    >
      {children}
    </button>
  )
}

/* ── 导航数据 ── */

const NAV_DATA = [
  { type: 'group', label: '通用' },
  { type: 'item', id: 'basic', label: '基础' },
  { type: 'item', id: 'ssh', label: 'SSH/SFTP' },
  { type: 'item', id: 'database', label: '数据库' },
  { type: 'solo', id: 'account', label: '账号', mt: true },
  { type: 'group', label: '快捷键', mt: true },
  { type: 'item', id: 'kb-basic', label: '基础' },
  { type: 'item', id: 'kb-ssh', label: 'SSH/SFTP' },
  { type: 'item', id: 'kb-database', label: '数据库' },
  { type: 'item', id: 'kb-docker', label: 'Docker' },
  { type: 'solo', id: 'storage', label: '储存仓库', mt: true },
  { type: 'solo', id: 'referral', label: '推介有奖', mt: true },
] as const

const CONTENT_MAP: Record<string, React.ComponentType> = {
  basic: BasicSettings,
  ssh: SSHSettings,
  database: DatabaseSettings,
}

/* ── 主组件 ── */

export default function SettingsPanel() {
  const toggleSettings = useAppStore((s) => s.toggleSettings)
  const dirty = useSettingsStore((s) => s._dirty)
  const applySettings = useSettingsStore((s) => s.applySettings)
  const resetToDefaults = useSettingsStore((s) => s.resetToDefaults)

  const [activeNav, setActiveNav] = useState('basic')
  const [pinned, setPinned] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const dragControls = useDragControls()
  const constraintRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleSettings()
      if (e.key === 's' && (e.ctrlKey || e.metaKey) && dirty) {
        e.preventDefault()
        applySettings()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleSettings, dirty, applySettings])

  const ContentComponent = CONTENT_MAP[activeNav]
  const PinIcon = pinned ? PinOff : Pin

  const panelSize = maximized
    ? 'w-full h-full max-w-full max-h-full rounded-none'
    : 'w-[1100px] max-w-[95vw] h-[720px] max-h-[95vh] rounded-2xl'

  return (
    <motion.div
      ref={constraintRef}
      className="fixed inset-0 z-[301] flex items-center justify-center pointer-events-none p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        drag={!maximized}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintRef}
        dragMomentum={false}
        dragElastic={0}
        initial={{ scale: 0.96 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.96 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={`pointer-events-auto ${panelSize} bg-[#F2F3F5] shadow-[0_16px_48px_rgba(0,0,0,0.16),0_4px_12px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — 缩减版主 Header */}
        <div
          className="h-[48px] flex items-center px-4 shrink-0 select-none bg-[#F2F3F5] cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => {
            if (!(e.target as HTMLElement).closest('button')) dragControls.start(e)
          }}
        >
          {/* 左：Logo */}
          <div className="flex items-center gap-0 w-[120px]">
            <VortixLogo />
            <span className="text-[#1F2329] font-bold text-[14px] tracking-wide ml-[1px]">ortix</span>
          </div>

          {/* 中：标题 */}
          <div className="flex-1 text-center">
            <span className="text-[#1F2329] font-medium text-[14px]">设置</span>
          </div>

          {/* 右：窗口控制 */}
          <div className="flex items-center gap-0.5 w-[120px] justify-end">
            <WinBtn onClick={() => setPinned(!pinned)}>
              <PinIcon size={13} className={pinned ? 'text-[#4080FF]' : ''} />
            </WinBtn>
            <WinBtn onClick={toggleSettings}>
              <Minus size={14} />
            </WinBtn>
            <WinBtn onClick={() => setMaximized(!maximized)}>
              <Square size={12} />
            </WinBtn>
            <WinBtn onClick={toggleSettings} hoverClass="hover:bg-[#FEE2E2]">
              <X size={14} />
            </WinBtn>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧导航 */}
          <div className="w-[180px] flex flex-col py-2 overflow-y-auto custom-scrollbar shrink-0 select-none bg-[#F2F3F5]">
            {NAV_DATA.map((item, i) => {
              if (item.type === 'group') {
                return (
                  <div key={i} className={`text-[12px] text-[#86909C] px-5 py-1.5 mb-1 font-medium ${'mt' in item && item.mt ? 'mt-3' : 'mt-1'}`}>
                    {item.label}
                  </div>
                )
              }
              const isActive = 'id' in item && item.id === activeNav
              return (
                <div
                  key={i}
                  onClick={() => { if ('id' in item) setActiveNav(item.id) }}
                  className={`text-[13px] font-medium px-4 py-2 cursor-pointer transition-colors rounded-lg mx-3 mb-0.5 ${
                    'mt' in item && item.mt ? 'mt-2' : ''
                  } ${
                    isActive
                      ? 'text-[#1F2329] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                      : 'text-[#4E5969] hover:bg-[#E5E6EB]/50'
                  }`}
                >
                  {item.label}
                </div>
              )
            })}
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 bg-white rounded-tl-2xl shadow-[-4px_0_12px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-24">
              {ContentComponent ? <ContentComponent /> : (
                <div className="flex items-center justify-center h-full text-[#86909C] text-[14px]">
                  即将推出
                </div>
              )}
            </div>

            {/* 底部栏 */}
            <div className="absolute bottom-0 left-0 right-0 h-[64px] bg-white/90 backdrop-blur-md border-t border-[#E5E6EB] flex items-center justify-end px-8 gap-4 rounded-br-2xl z-10">
              <span className="text-[#86909C] text-[12px] mr-2">修改设置后如未生效，请重启页面或重启应用</span>
              <button
                className="px-5 py-2 bg-[#F2F3F5] text-[#4E5969] rounded-lg text-[13px] hover:bg-[#E5E6EB] transition-colors font-medium"
                onClick={resetToDefaults}
              >
                恢复默认
              </button>
              <button
                className={`px-5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  dirty
                    ? 'bg-[#E8F0FF] text-[#4080FF] hover:bg-[#DCE6FA] cursor-pointer'
                    : 'bg-[#F2F3F5] text-[#C9CDD4] cursor-not-allowed'
                }`}
                disabled={!dirty}
                onClick={applySettings}
              >
                应用 (Ctrl+S)
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
