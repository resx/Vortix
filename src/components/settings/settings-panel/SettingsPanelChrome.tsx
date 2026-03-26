import type { ReactNode } from 'react'
import { AppIcon, icons } from '../../icons/AppIcon'

function GlitchBox({ size = 20 }: { size?: number }) {
  const fontSize = Math.round(size * 0.55)
  const scanLineSize = size <= 24 ? 2 : 4
  const isDark = document.documentElement.classList.contains('dark')

  return (
    <div
      className={`relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-md ${
        isDark
          ? 'border border-gray-700 bg-[#000] shadow-[0_0_12px_rgba(34,211,238,0.12)]'
          : 'border border-gray-800 bg-[#111] shadow-sm'
      }`}
      style={{ width: size, height: size }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-20 opacity-40"
        style={{ background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.5) 50%)', backgroundSize: `100% ${scanLineSize}px` }}
      />
      <div className="relative flex font-mono font-black tracking-tighter" style={{ fontSize: `${fontSize}px` }}>
        <span className="absolute -left-[1px] top-[1px] text-cyan-400 mix-blend-screen blur-[0.3px]" style={{ animation: 'holoFlicker 5s infinite' }}>
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite' }}>_</span>
        </span>
        <span className="absolute -top-[1px] left-[1px] text-rose-500 mix-blend-screen blur-[0.3px]" style={{ animation: 'holoFlicker 5s infinite 150ms' }}>
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite' }}>_</span>
        </span>
        <span className="relative z-10 text-white">
          &gt;<span style={{ animation: 'terminalBlink 2s step-end infinite', filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }}>_</span>
        </span>
      </div>
    </div>
  )
}

function SettingsLogoGroup() {
  return (
    <div className="flex items-center">
      <GlitchBox />
      <div className="ml-1.5 mt-0.5 flex flex-col">
        <span
          className="text-text-1"
          style={{
            fontFamily: "'Chakra Petch', sans-serif",
            fontSize: '14px',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}
        >
          Vortix
        </span>
        <div className="relative mt-1 h-[2px] w-full overflow-hidden rounded-full bg-border/60">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-400/40 to-transparent" />
          <div className="absolute h-full w-6 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" style={{ animation: 'trackPulse 2.5s cubic-bezier(0.4,0,0.2,1) infinite' }} />
        </div>
      </div>
    </div>
  )
}

function WinBtn({
  children,
  onClick,
  hoverClass = 'hover:bg-border',
}: {
  children: ReactNode
  onClick?: () => void
  hoverClass?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[28px] w-[28px] items-center justify-center rounded-md text-text-3 transition-colors hover:text-text-1 ${hoverClass}`}
    >
      {children}
    </button>
  )
}

export function SettingsPanelChrome({
  pinned,
  maximized,
  onTogglePinned,
  onToggleMaximized,
  onClose,
  onMinimize,
  onDragStart,
}: {
  pinned: boolean
  maximized: boolean
  onTogglePinned: () => void
  onToggleMaximized: () => void
  onClose: () => void
  onMinimize: () => void
  onDragStart: (event: React.PointerEvent<HTMLDivElement>) => void
}) {
  const pinIcon = pinned ? icons.pinOff : icons.pin

  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(64,128,255,0.12),transparent_42%),radial-gradient(circle_at_88%_100%,rgba(103,194,58,0.1),transparent_36%)]" />
      <div
        className="relative z-10 mx-3 mt-3 flex h-[52px] shrink-0 cursor-grab select-none items-center rounded-2xl border border-border/70 bg-bg-card/78 px-4 shadow-[0_10px_24px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md active:cursor-grabbing"
        onPointerDown={onDragStart}
      >
        <div className="flex w-[120px] items-center">
          <SettingsLogoGroup />
        </div>
        <div className="flex-1 text-center">
          <span className="text-[14px] font-medium text-text-1">设置</span>
        </div>
        <div className="flex w-[120px] items-center justify-end gap-0.5">
          <WinBtn onClick={onTogglePinned}>
            <AppIcon icon={pinIcon} size={13} className={pinned ? 'text-primary' : ''} />
          </WinBtn>
          <WinBtn onClick={onMinimize}>
            <AppIcon icon={icons.minimize} size={14} />
          </WinBtn>
          <WinBtn onClick={onToggleMaximized}>
            <AppIcon icon={icons.maximize} size={12} className={maximized ? 'text-primary' : ''} />
          </WinBtn>
          <WinBtn onClick={onClose} hoverClass="hover:bg-[#FEE2E2]">
            <AppIcon icon={icons.close} size={14} />
          </WinBtn>
        </div>
      </div>
    </>
  )
}
